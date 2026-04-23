import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ClassRow = {
  id: string | number;
  title?: string | null;
  time?: string | null;
};

type BookingRow = {
  class_id?: string | number | null;
  member_id?: string | number | null;
};

type MemberRow = {
  id: string | number;
  ldap?: string | null;
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

function getTodayKstDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

async function sendKakaoworkReminder(params: { email: string; classTitle: string; classTime: string }) {
  const botApiKey = process.env.KAKAOWORK_BOT_API_KEY;
  if (!botApiKey) throw new Error("Missing KAKAOWORK_BOT_API_KEY");

  const headerText = "🙌🏻 크루브 클래스 데이!";
  const reminderText = `오늘 ${params.classTime}에 [${params.classTitle}] 클래스가 진행됩니다. 잊지 말고 참석해주세요!`;
  const payload = {
    email: params.email,
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
        text: reminderText,
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

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ message: "Missing CRON_SECRET" }, { status: 500 });
    }

    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const todayKst = getTodayKstDate();

    const { data: classRows, error: classError } = await supabase
      .from("classes")
      .select("id, title, time")
      .eq("date", todayKst);
    if (classError) {
      return NextResponse.json({ message: classError.message }, { status: 500 });
    }

    const classes = (classRows ?? []) as ClassRow[];
    if (classes.length === 0) {
      return NextResponse.json({
        message: "No classes scheduled today.",
        date: todayKst,
        classesCount: 0,
        recipientsCount: 0,
        sentCount: 0,
      });
    }

    const classIds = classes.map((item) => item.id).filter(Boolean);
    const { data: bookingRows, error: bookingError } = await supabase
      .from("bookings")
      .select("class_id, member_id")
      .in("class_id", classIds)
      .eq("status", "completed");
    if (bookingError) {
      return NextResponse.json({ message: bookingError.message }, { status: 500 });
    }

    const bookings = (bookingRows ?? []) as BookingRow[];
    if (bookings.length === 0) {
      return NextResponse.json({
        message: "No recipients for today's classes.",
        date: todayKst,
        classesCount: classes.length,
        recipientsCount: 0,
        sentCount: 0,
      });
    }

    const classById = new Map(classes.map((item) => [String(item.id), item]));
    const memberIds = Array.from(
      new Set(bookings.map((item) => item.member_id).filter((id): id is string | number => Boolean(id)))
    );

    const { data: memberRows, error: memberError } = await supabase
      .from("members")
      .select("id, ldap")
      .in("id", memberIds);
    if (memberError) {
      return NextResponse.json({ message: memberError.message }, { status: 500 });
    }

    const memberById = new Map(
      ((memberRows ?? []) as MemberRow[]).map((item) => [String(item.id), item.ldap ?? ""])
    );

    const targets = bookings
      .map((booking) => {
        const classId = String(booking.class_id ?? "");
        const memberId = String(booking.member_id ?? "");
        const classInfo = classById.get(classId);
        const ldap = memberById.get(memberId) ?? "";
        if (!classInfo?.title || !ldap) return null;
        const classTimeRaw = (classInfo.time ?? "").trim();
        const classTime = classTimeRaw.length >= 5 ? classTimeRaw.slice(0, 5) : "00:00";

        return {
          email: `${ldap}@kakaocorp.com`,
          classTitle: classInfo.title,
          classTime,
        };
      })
      .filter((item): item is { email: string; classTitle: string; classTime: string } => Boolean(item));

    if (targets.length === 0) {
      return NextResponse.json({
        message: "No valid recipients found.",
        date: todayKst,
        classesCount: classes.length,
        recipientsCount: 0,
        sentCount: 0,
      });
    }

    const results = await Promise.allSettled(
      targets.map((target) =>
        sendKakaoworkReminder({
          email: target.email,
          classTitle: target.classTitle,
          classTime: target.classTime,
        })
      )
    );

    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    const failedCount = results.length - sentCount;

    return NextResponse.json({
      message: "Reminder job finished.",
      date: todayKst,
      classesCount: classes.length,
      recipientsCount: targets.length,
      sentCount,
      failedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
