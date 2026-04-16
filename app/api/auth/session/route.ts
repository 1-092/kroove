import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  createSessionToken,
  getSessionMaxAgeSeconds,
  SESSION_COOKIE_NAME,
} from "@/src/lib/server/session";

type LoginRequest = {
  ldap?: string;
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
    const body = (await request.json()) as LoginRequest;
    const ldap = body.ldap?.trim();
    if (!ldap) {
      return NextResponse.json({ message: "ldap가 필요합니다." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: member, error } = await supabase
      .from("members")
      .select("ldap")
      .eq("ldap", ldap)
      .maybeSingle();

    if (error || !member) {
      return NextResponse.json({ message: "유효한 사용자 정보가 없습니다." }, { status: 401 });
    }

    const token = createSessionToken(ldap);
    const response = NextResponse.json({ message: "ok" });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: getSessionMaxAgeSeconds(),
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ message: "logged out" });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
