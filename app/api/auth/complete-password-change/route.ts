import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

type RequestBody = {
  userId?: string;
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
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;
    const userId = body.userId?.trim();
    if (!userId) {
      return NextResponse.json({ message: "userId가 필요합니다." }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("members")
      .update({ is_initial_password: false })
      .eq("id", userId)
      .eq("ldap", session.ldap)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ message: "대상 회원을 찾지 못했습니다." }, { status: 404 });
    }

    return NextResponse.json({ message: "ok" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
