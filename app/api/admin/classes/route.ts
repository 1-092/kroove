import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

type CreateClassRequest = {
  className?: string;
  date?: string;
  time?: string;
  isFirstComeOpen?: boolean;
  openDate?: string;
  openTime?: string;
  maxParticipants?: number;
  classType?: "정규" | "품앗이";
  description?: string;
  youtubeUrl?: string;
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

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.ldap) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as CreateClassRequest;
    const className = body.className?.trim();
    const date = body.date?.trim();
    const time = body.time?.trim();
    const isFirstComeOpen = body.isFirstComeOpen === true;
    const openDate = body.openDate?.trim();
    const openTime = body.openTime?.trim();
    const maxParticipants = Number(body.maxParticipants);
    const classType = body.classType ?? "정규";
    const description = body.description?.trim() ?? "";
    const youtubeUrl = body.youtubeUrl?.trim() ?? "";

    if (!className || !date || !time || Number.isNaN(maxParticipants) || maxParticipants <= 0) {
      return NextResponse.json({ message: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: requester, error: requesterError } = await supabase
      .from("members")
      .select("role")
      .eq("ldap", session.ldap)
      .maybeSingle();

    const requesterRole = (requester as { role?: string } | null)?.role ?? "";
    if (requesterError || !requesterRole) {
      return NextResponse.json({ message: "관리자 권한이 없습니다." }, { status: 403 });
    }
    if (classType === "정규" && !["head", "manager"].includes(requesterRole)) {
      return NextResponse.json(
        { message: "정규 클래스는 운영진/회장만 개설할 수 있습니다." },
        { status: 403 }
      );
    }
    if (
      classType === "정규" &&
      isFirstComeOpen &&
      (!openDate || !openTime)
    ) {
      return NextResponse.json(
        { message: "정규 클래스는 신청 오픈 날짜와 시간이 필요합니다." },
        { status: 400 }
      );
    }

    const openAt =
      classType === "정규" && isFirstComeOpen && openDate && openTime
        ? `${openDate}T${openTime.length === 5 ? `${openTime}:00` : openTime}`
        : null;

    const classPayload = {
      class_type: classType,
      title: className,
      created_who: session.ldap,
      open_at: openAt,
      date,
      time,
      max_participants: Math.floor(maxParticipants),
      current_participants: 0,
      description: description || null,
      youtube_url: youtubeUrl || null,
    };

    const { data, error } = await supabase
      .from("classes")
      .insert(classPayload)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "ok", class: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
