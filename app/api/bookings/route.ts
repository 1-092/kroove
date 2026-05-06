import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

type BookingStatus = "completed" | "pending" | "canceled";

type BookingRow = {
  member_id?: string | number | null;
  status?: BookingStatus | null;
  created_at?: string | null;
  members?: { ldap?: string | null } | Array<{ ldap?: string | null }> | null;
};

type ClassWithBookingsRow = {
  id?: string | number | null;
  class_type?: string | null;
  created_who?: string | null;
  open_at?: string | null;
  date?: string | null;
  time?: string | null;
  title?: string | null;
  description?: string | null;
  max_participants?: number | null;
  current_participants?: number | null;
  youtube_url?: string | null;
  bookings?: BookingRow[] | null;
};

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

async function sendKakaoworkBookingCompletedMessage(params: {
  ldap: string;
  classTitle: string;
  classDateTime: string;
}) {
  const botApiKey = process.env.KAKAOWORK_BOT_API_KEY;
  if (!botApiKey) return;

  const email = `${params.ldap}@kakaocorp.com`;
  const headerText = "🔥 클래스 참여 신청 완료";

  const payload = {
    email,
    text: headerText,
    blocks: [
      {
        type: "header",
        style: "blue",
        text: headerText,
      },
      {
        type: "text",
        markdown: true,
        text: `**${params.ldap}**님, [${params.classTitle}] 클래스 참여자에 추가되었습니다. ${params.classDateTime}에 만나요!`,
      },
      {
        type: "button",
        text: "확인하러가기",
        action_type: "open_system_browser",
        value: "https://kroove.vercel.app",
      },
    ],
  };

  const response = await fetch("https://api.kakaowork.com/v1/messages.send_by_email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`KakaoWork API request failed (${response.status}): ${errorText}`);
  }
}

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

function formatClassDateTimeForMessage(dateValue?: string | null, timeValue?: string | null) {
  const dateText = (dateValue ?? "").trim();
  const timeText = (timeValue ?? "").trim();

  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const month = dateMatch ? Number(dateMatch[2]) : null;
  const day = dateMatch ? Number(dateMatch[3]) : null;

  const timeMatch = timeText.match(/^(\d{2}):(\d{2})/);
  const hh = timeMatch ? timeMatch[1] : "00";
  const mm = timeMatch ? timeMatch[2] : "00";

  if (month && day) {
    return `${month}월 ${day}일 ${hh}:${mm}`;
  }
  return `${hh}:${mm}`;
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

async function getMemberLdapById(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  memberId: string | number
) {
  const { data, error } = await supabase
    .from("members")
    .select("ldap")
    .eq("id", memberId)
    .maybeSingle();
  if (error) return null;
  return (data as { ldap?: string | null } | null)?.ldap ?? null;
}

async function getBookingState(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  classId: string,
  memberId: string | number
) {
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, class_type, created_who, open_at, date, time, title, description, max_participants, current_participants, youtube_url, bookings(member_id, status, created_at, members(ldap))"
    )
    .eq("id", classId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("class not found");

  const classData = data as ClassWithBookingsRow;
  const rows = [...(classData.bookings ?? [])].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );

  const getBookingLdap = (row: BookingRow) => {
    const membersValue = row.members;
    if (Array.isArray(membersValue)) return membersValue[0]?.ldap ?? "";
    return membersValue?.ldap ?? "";
  };

  const completedRows = rows.filter((row) => row.status === "completed");
  const pendingRows = rows.filter((row) => row.status === "pending");

  const applicantLdaps = completedRows
    .map(getBookingLdap)
    .filter((ldap): ldap is string => Boolean(ldap));
  const pendingLdaps = pendingRows
    .map(getBookingLdap)
    .filter((ldap): ldap is string => Boolean(ldap));

  const mine = rows.find((row) => String(row.member_id) === String(memberId));
  const myStatus = mine?.status === "completed" || mine?.status === "pending" ? mine.status : null;
  return {
    classData: {
      id: classData.id,
      class_type: classData.class_type,
      created_who: classData.created_who,
      open_at: classData.open_at,
      date: classData.date,
      time: classData.time,
      title: classData.title,
      description: classData.description,
      max_participants: classData.max_participants,
      current_participants: classData.current_participants,
      youtube_url: classData.youtube_url,
    },
    myStatus,
    applicantLdaps,
    pendingLdaps,
    currentSeats: completedRows.length,
    maxSeats: Number(classData.max_participants ?? 0),
  };
}

export async function GET(request: Request) {
  const startMs = nowMs();
  const marks: Record<string, number> = {};
  try {
    const mark = (name: string) => {
      marks[name] = nowMs() - startMs;
    };

    const ldap = await getSessionLdap();
    mark("session_checked");
    if (!ldap) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId")?.trim();
    mark("query_parsed");
    if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const memberId = await getMemberIdByLdap(supabase, ldap);
    mark("member_loaded");
    if (!memberId) return NextResponse.json({ message: "member not found" }, { status: 404 });

    const state = await getBookingState(supabase, classId, memberId);
    mark("booking_state_loaded");
    await supabase.from("classes").update({ current_participants: state.currentSeats }).eq("id", classId);
    mark("participants_synced");
    const totalMs = nowMs() - startMs;
    console.info(
      `[bookings:get] classId=${classId} total=${totalMs}ms session=${marks.session_checked ?? 0}ms member=${(marks.member_loaded ?? totalMs) - (marks.query_parsed ?? 0)}ms state=${(marks.booking_state_loaded ?? totalMs) - (marks.member_loaded ?? 0)}ms sync=${(marks.participants_synced ?? totalMs) - (marks.booking_state_loaded ?? 0)}ms`
    );
    return NextResponse.json(state, {
      status: 200,
      headers: { "Server-Timing": `total;dur=${totalMs}` },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const totalMs = nowMs() - startMs;
    console.error(`[bookings:get] failed after ${totalMs}ms`, message);
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const startMs = nowMs();
  const marks: Record<string, number> = {};
  try {
    const mark = (name: string) => {
      marks[name] = nowMs() - startMs;
    };

    const ldap = await getSessionLdap();
    mark("session_checked");
    if (!ldap) return NextResponse.json({ message: "unauthorized" }, { status: 401 });

    const body = (await request.json()) as { classId?: string };
    const classId = body.classId?.trim();
    mark("body_parsed");
    if (!classId) return NextResponse.json({ message: "classId is required" }, { status: 400 });

    const supabase = createAdminSupabaseClient();
    const memberId = await getMemberIdByLdap(supabase, ldap);
    mark("member_loaded");
    if (!memberId) return NextResponse.json({ message: "member not found" }, { status: 404 });

    const { data: classData, error: classError } = await supabase
      .from("classes")
      .select("max_participants, title, date, time")
      .eq("id", classId)
      .maybeSingle();
    mark("class_loaded");
    if (classError) return NextResponse.json({ message: classError.message }, { status: 500 });
    const maxSeats = Number((classData as { max_participants?: number | null } | null)?.max_participants ?? 0);
    const classTitle = (classData as { title?: string | null } | null)?.title ?? "제목 없음 클래스";
    const classDate = (classData as { date?: string | null } | null)?.date ?? "";
    const classTime = (classData as { time?: string | null } | null)?.time ?? "";
    const classDateTime = formatClassDateTimeForMessage(classDate, classTime);

    const { data: existingRows, error: existingError } = await supabase
      .from("bookings")
      .select("member_id, status, created_at")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });
    mark("existing_bookings_loaded");
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
      mark("booking_canceled");
      if (cancelError) return NextResponse.json({ message: cancelError.message }, { status: 500 });

      if (myExisting.status === "completed") {
        const { data: pendingRows, error: pendingError } = await supabase
          .from("bookings")
          .select("member_id")
          .eq("class_id", classId)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1);
        mark("next_pending_loaded");
        if (pendingError) return NextResponse.json({ message: pendingError.message }, { status: 500 });
        const nextMemberId = pendingRows?.[0]?.member_id;
        if (nextMemberId) {
          const { error: promoteError } = await supabase
            .from("bookings")
            .update({ status: "completed" })
            .eq("class_id", classId)
            .eq("member_id", nextMemberId);
          mark("pending_promoted");
          if (promoteError) return NextResponse.json({ message: promoteError.message }, { status: 500 });

          const promotedLdap = await getMemberLdapById(supabase, nextMemberId);
          if (promotedLdap) {
            try {
              await sendKakaoworkBookingCompletedMessage({
                ldap: promotedLdap,
                classTitle,
                classDateTime,
              });
              mark("promoted_notification_sent");
            } catch (notifyError) {
              console.error("[kakaowork] failed to send promoted booking completion message:", notifyError);
            }
          }
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
        mark("booking_updated");
        if (updateError) return NextResponse.json({ message: updateError.message }, { status: 500 });
      } else {
        const { error: insertError } = await supabase
          .from("bookings")
          .insert({ class_id: classId, member_id: memberId, status: nextStatus });
        mark("booking_inserted");
        if (insertError) return NextResponse.json({ message: insertError.message }, { status: 500 });
      }
      message = nextStatus === "completed" ? "클래스 참여가 완료되었습니다." : "대기 신청이 완료되었습니다.";
      if (nextStatus === "completed") {
        try {
          await sendKakaoworkBookingCompletedMessage({
            ldap,
            classTitle,
            classDateTime,
          });
          mark("self_notification_sent");
        } catch (notifyError) {
          console.error("[kakaowork] failed to send booking completion message:", notifyError);
        }
      }
    }

    const state = await getBookingState(supabase, classId, memberId);
    mark("booking_state_loaded");
    const { error: syncError } = await supabase
      .from("classes")
      .update({ current_participants: state.currentSeats })
      .eq("id", classId);
    mark("participants_synced");
    if (syncError) return NextResponse.json({ message: syncError.message }, { status: 500 });

    const totalMs = nowMs() - startMs;
    console.info(
      `[bookings:post] classId=${classId} total=${totalMs}ms session=${marks.session_checked ?? 0}ms member=${(marks.member_loaded ?? totalMs) - (marks.body_parsed ?? 0)}ms class=${(marks.class_loaded ?? totalMs) - (marks.member_loaded ?? 0)}ms existing=${(marks.existing_bookings_loaded ?? totalMs) - (marks.class_loaded ?? 0)}ms mutate=${(marks.booking_state_loaded ?? totalMs) - (marks.existing_bookings_loaded ?? 0)}ms sync=${(marks.participants_synced ?? totalMs) - (marks.booking_state_loaded ?? 0)}ms`
    );
    return NextResponse.json({ message, ...state }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const totalMs = nowMs() - startMs;
    console.error(`[bookings:post] failed after ${totalMs}ms`, message);
    return NextResponse.json({ message }, { status: 500 });
  }
}
