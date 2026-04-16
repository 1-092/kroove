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
    const { data: requester, error: requesterError } = await supabase
      .from("members")
      .select("role")
      .eq("ldap", session.ldap)
      .maybeSingle();

    if (
      requesterError ||
      !requester ||
      !["head", "manager"].includes((requester as { role?: string }).role ?? "")
    ) {
      return NextResponse.json({ message: "forbidden" }, { status: 403 });
    }

    const { data: members, error } = await supabase
      .from("members")
      .select("id, ldap, name, role, status")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ members: members ?? [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

type PatchBody = {
  memberId?: string;
  role?: "member" | "manager" | "head";
  status?: "active" | "withdrawn";
};

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.ldap) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: requester, error: requesterError } = await supabase
      .from("members")
      .select("role")
      .eq("ldap", session.ldap)
      .maybeSingle();

    if (
      requesterError ||
      !requester ||
      !["head", "manager"].includes((requester as { role?: string }).role ?? "")
    ) {
      return NextResponse.json({ message: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as PatchBody;
    const memberId = body.memberId?.trim();
    const role = body.role;
    const status = body.status;

    if (!memberId || (!role && !status)) {
      return NextResponse.json({ message: "invalid payload" }, { status: 400 });
    }

    const updates: { role?: "member" | "manager" | "head"; status?: "active" | "withdrawn" } = {};
    if (role) {
      if (!["member", "manager", "head"].includes(role)) {
        return NextResponse.json({ message: "invalid role" }, { status: 400 });
      }
      updates.role = role;
    }
    if (status) {
      if (!["active", "withdrawn"].includes(status)) {
        return NextResponse.json({ message: "invalid status" }, { status: 400 });
      }
      updates.status = status;
    }

    const { data, error } = await supabase
      .from("members")
      .update(updates)
      .eq("id", memberId)
      .select("id, ldap, name, role, status")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ message: "member not found" }, { status: 404 });
    }

    return NextResponse.json({ member: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
