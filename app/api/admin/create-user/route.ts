import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/src/lib/server/session";

type CreateUserRequest = {
  userId?: string;
  name?: string;
  role?: "member" | "manager" | "head";
};

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateUserRequest;
    const userId = body.userId?.trim();
    const name = body.name?.trim();
    const role = body.role ?? "member";

    if (!userId || !name) {
      return NextResponse.json(
        { message: "userId와 name은 필수입니다." },
        { status: 400 }
      );
    }

    if (!["member", "manager", "head"].includes(role)) {
      return NextResponse.json(
        { message: "role 값이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const session = verifySessionToken(token);
    if (!session?.ldap) {
      return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
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
      return NextResponse.json(
        { message: "관리자 권한이 없습니다." },
        { status: 403 }
      );
    }

    const email = `${userId}@kakaocorp.com`;

    const { data: createdUserData, error: createUserError } =
      await supabase.auth.admin.createUser({
        email,
        password: "000000",
        email_confirm: true,
      });

    if (createUserError || !createdUserData.user) {
      return NextResponse.json(
        { message: createUserError?.message ?? "유저 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    const authUserId = createdUserData.user.id;
    const { error: insertMemberError } = await supabase.from("members").insert({
      id: authUserId,
      name,
      ldap: userId,
      role,
      status: "active",
      is_initial_password: true,
    });

    if (insertMemberError) {
      await supabase.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { message: `members insert 실패: ${insertMemberError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "사용자 생성 완료",
        user: {
          id: authUserId,
          email,
          userId,
          name,
          role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
