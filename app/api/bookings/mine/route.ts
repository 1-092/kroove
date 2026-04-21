import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

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

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.ldap) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: me, error: meError } = await supabase
      .from("members")
      .select("id")
      .eq("ldap", session.ldap)
      .maybeSingle();
    if (meError || !me?.id) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("bookings")
      .select("class_id, status")
      .eq("member_id", me.id)
      .in("status", ["completed", "pending"]);
    if (rowsError) {
      return NextResponse.json({ message: rowsError.message }, { status: 500 });
    }

    const byClass: Record<string, "completed" | "pending"> = {};
    ((rows ?? []) as Array<{ class_id?: string | number | null; status?: string | null }>).forEach(
      (row) => {
        const classId = row.class_id ? String(row.class_id) : "";
        if (!classId) return;
        if (row.status === "completed" || row.status === "pending") {
          byClass[classId] = row.status;
        }
      }
    );

    return NextResponse.json({ byClass }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
