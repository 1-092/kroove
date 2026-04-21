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

type UpdateClassRequest = {
  classId?: string | number;
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

function parseKstDateTimeToTs(date: string, time: string) {
  const m = `${date} ${time}`.match(
    /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? "0");
  return Date.UTC(year, month - 1, day, hour - 9, minute, second);
}

function normalizeDateTimeText(input?: string | null) {
  if (!input) return null;
  const m = input.match(/(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1]} ${m[2]}:${m[3] ?? "00"}`;
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
        ? `${openDate} ${openTime.length === 5 ? `${openTime}:00` : openTime}`
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

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.ldap) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
    }

    const body = (await request.json()) as UpdateClassRequest;
    const classId = String(body.classId ?? "").trim();
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

    if (
      !classId ||
      !className ||
      !date ||
      !time ||
      Number.isNaN(maxParticipants) ||
      maxParticipants <= 0
    ) {
      return NextResponse.json({ message: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }
    if (classType === "정규" && isFirstComeOpen && (!openDate || !openTime)) {
      return NextResponse.json(
        { message: "정규 클래스는 신청 오픈 날짜와 시간이 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();
    const { data: targetClass, error: targetClassError } = await supabase
      .from("classes")
      .select("id, created_who, date, time, open_at")
      .eq("id", classId)
      .maybeSingle();
    if (targetClassError) {
      return NextResponse.json({ message: targetClassError.message }, { status: 500 });
    }
    if (!targetClass) {
      return NextResponse.json({ message: "클래스를 찾을 수 없습니다." }, { status: 404 });
    }
    if ((targetClass as { created_who?: string | null }).created_who !== session.ldap) {
      return NextResponse.json({ message: "개설자만 수정할 수 있습니다." }, { status: 403 });
    }

    const classDate = (targetClass as { date?: string | null }).date ?? "";
    const classTime = (targetClass as { time?: string | null }).time ?? "";
    const classTs = parseKstDateTimeToTs(classDate, classTime);
    if (Number.isFinite(classTs) && Date.now() > classTs) {
      return NextResponse.json({ message: "이미 시작 또는 종료된 클래스입니다." }, { status: 400 });
    }

    const openAt =
      classType === "정규" && isFirstComeOpen && openDate && openTime
        ? `${openDate} ${openTime.length === 5 ? `${openTime}:00` : openTime}`
        : null;

    const prevOpenAt = ((targetClass as { open_at?: string | null }).open_at ?? null) as string | null;
    const prevOpenAtNormalized = normalizeDateTimeText(prevOpenAt);
    const nextOpenAtNormalized = normalizeDateTimeText(openAt);
    const isOpenAtChanged = prevOpenAtNormalized !== nextOpenAtNormalized;
    if (isOpenAtChanged) {
      const { data: existingApplicants, error: applicantsError } = await supabase
        .from("bookings")
        .select("member_id")
        .eq("class_id", classId)
        .in("status", ["completed", "pending"])
        .limit(1);
      if (applicantsError) {
        return NextResponse.json({ message: applicantsError.message }, { status: 500 });
      }
      if ((existingApplicants ?? []).length > 0) {
        return NextResponse.json(
          { message: "이미 신청자가 있는 클래스의 선착순신청 일시는 변경할 수 없습니다." },
          { status: 400 }
        );
      }
    }

    const classPayload = {
      class_type: classType,
      title: className,
      open_at: openAt,
      date,
      time,
      max_participants: Math.floor(maxParticipants),
      description: description || null,
      youtube_url: youtubeUrl || null,
    };

    const { data, error } = await supabase
      .from("classes")
      .update(classPayload)
      .eq("id", classId)
      .select("*")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "ok", class: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
