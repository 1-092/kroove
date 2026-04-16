import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

type BookingStatus = "completed" | "pending" | "canceled";

type BookingRow = {
  member_id?: string | number | null;
  status?: BookingStatus | null;
};

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getSessionLdap() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  return session?.ldap ?? null;
}

async function getMemberIdByLdap(supabase: ReturnType<typeof createAdminSupabaseClient>, ldap: string) {
  const { data, error } = await supabase.from("members").select("id").eq("ldap", ldap).maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string | number;
}

async function getBookingState(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  classId: string,
  memberId: string | number
) {
  const { data: bookingRows, error: bookingError } = await supabase
    .from("bookings")
    .select("member_id, status, created_at")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });
  if (bookingError) throw new Error(bookingError.message);

  const rows = (bookingRows ?? []) as BookingRow[];
  const completedRows = rows.filter((row) => row.status === "completed");
  const completedIds = completedRows
    .map((row) => row.member_id)
    .filter((id): id is string | number => Boolean(id));

  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("max_participants")
    .eq("id", classId)
    .maybeSingle();
  if (classError) throw new Error(classError.message);
  const maxParticipants = Number((classData as { max_participants?: number | null } | null)?.max_participants ?? 0);

  let applicantLdaps: string[] = [];
  if (completedIds.length > 0) {
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, ldap")
      .in("id", completedIds);
    if (membersError) throw new Error(membersError.message);
    const ldapById = new Map(
      ((members ?? []) as Array<{ id: string | number; ldap?: string | null }>).map((member) => [
        String(member.id),
        member.ldap ?? "",
      ])
    );
    applicantLdaps = completedIds
      .map((id) => ldapById.get(String(id)) ?? "")
      .filter((ldap): ldap is string => Boolean(ldap));
  }

  const mine = rows.find((row) => String(row.member_id) === String(memberId));
  const myStatus = mine?.status === "completed" || mine?.status === "pending" ? mine.status : null;
  return {
    myStatus,
    applicantLdaps,
    currentSeats: completedIds.length,
    maxSeats: maxParticipants,
  };
}

export async function GET(request: Request) {
  try {
    const ldap = await getSessionLdap();
    if (!ldap) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId")?.trim();
    if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const memberId = await getMemberIdByLdap(supabase, ldap);
    if (!memberId) return NextResponse.json({ message: "member not found" }, { status: 404 });

    const state = await getBookingState(supabase, classId, memberId);
    await supabase.from("classes").update({ current_participants: state.currentSeats }).eq("id", classId);
    return NextResponse.json(state, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ldap = await getSessionLdap();
    if (!ldap) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const body = (await request.json()) as { classId?: string };
    const classId = body.classId?.trim();
    if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const memberId = await getMemberIdByLdap(supabase, ldap);
    if (!memberId) return NextResponse.json({ message: "member not found" }, { status: 404 });

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("max_participants")
      .eq("id", classId)
      .maybeSingle();
    if (classError) return NextResponse.json({ message: classError.message }, { status: 500 });
    const maxSeats = Number((classData as { max_participants?: number | null } | null)?.max_participants ?? 0);

    const { data: existingRows, error: existingError } = await supabase
      .from("bookings")
      .select("member_id, status, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });
    if (existingError) return NextResponse.json({ message: existingError.message }, { status: 500 });

    const rows = (existingRows ?? []) as BookingRow[];
    const completedCount = rows.filter((row) => row.status === "completed").length;
    const myExisting = rows.find((row) => String(row.member_id) === String(memberId));

    let message = "신청 처리 완료";
    if (myExisting && (myExisting.status === "completed" || myExisting.status === "pending")) {
      const { error: cancelError } = await supabase
        .from("bookings")
        .update({ status: "canceled" })
        .eq("class_id", classId)
        .eq("member_id", memberId);
      if (cancelError) return NextResponse.json({ message: cancelError.message }, { status: 500 });

      if (myExisting.status === "completed") {
        const { data: pendingRows, error: pendingError } = await supabase
          .from("bookings")
          .select("member_id")
          .eq("class_id", classId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1);
        if (pendingError) return NextResponse.json({ message: pendingError.message }, { status: 500 });
        const nextMemberId = pendingRows?.[0]?.member_id;
        if (nextMemberId) {
          const { error: promoteError } = await supabase
            .from("bookings")
            .update({ status: "completed" })
            .eq("class_id", classId)
            .eq("member_id", nextMemberId);
          if (promoteError) return NextResponse.json({ message: promoteError.message }, { status: 500 });
        }
      }
      message = "신청이 취소되었습니다.";
    } else {
      const nextStatus: BookingStatus = completedCount >= maxSeats ? "pending" : "completed";
      if (myExisting) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update({ status: nextStatus })
          .eq("class_id", classId)
          .eq("member_id", memberId);
        if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });
      } else {
        const { error: insertError } = await supabase
          .from("bookings")
          .insert({ class_id: classId, member_id: memberId, status: nextStatus });
        if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 });
      }
      message = nextStatus === "completed" ? "클래스 참여가 완료되었습니다." : "대기 신청이 완료되었습니다.";
    }

    const state = await getBookingState(supabase, classId, memberId);
    const { error: syncError } = await supabase
      .from("classes")
      .update({ current_participants: state.currentSeats })
      .eq("id", classId);
    if (syncError) return NextResponse.json({ message: syncError.message }, { status: 500 });

    return NextResponse.json({ message, ...state }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
