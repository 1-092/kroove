"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [lDap, setLDap] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const redirectIfLoggedIn = async () => {
      const response = await fetch("/api/auth/me", { method: "GET" });
      if (!response.ok) return;
      router.replace("/home");
    };

    void redirectIfLoggedIn();
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmedLdap = lDap.trim();
    const email = `${trimmedLdap}@kakaocorp.com`;

// 1️⃣ 먼저 지하 금고(auth.users) 문부터 엽니다! (로그인 먼저)
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // 👇 이 줄을 추가해서 진짜 이유를 콘솔에서 확인해 보세요!
      console.error("🚨 Supabase가 뱉은 진짜 로그인 에러:", signInError.message);
      setError("아이디 또는 비밀번호를 확인해주세요.");
      setIsSubmitting(false);
      return;
    }

    // 2️⃣ 로그인이 성공했으니(VIP 출입증 생김), 이제 당당하게 1층 로비(members) 명부를 확인합니다!
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, is_initial_password, status")
      .eq("ldap", trimmedLdap)
      .maybeSingle();

    if (memberError || !member) {
      setError("등록된 회원이 아닙니다.");
      // 만약 로그인은 됐는데 members 명단에 없다면, 다시 로그아웃 시키는 게 안전합니다.
      await supabase.auth.signOut(); 
      setIsSubmitting(false);
      return;
    }

    if (member.status === "withdrawn") {
      setError("탈퇴된 회원입니다.");
      await supabase.auth.signOut();
      setIsSubmitting(false);
      return;
    }

    const sessionResponse = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ldap: trimmedLdap }),
    });

    if (!sessionResponse.ok) {
      setError("세션 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      await supabase.auth.signOut();
      setIsSubmitting(false);
      return;
    }

    const mustChangePassword =
      member.is_initial_password === true ||
      member.is_initial_password === "true" ||
      member.is_initial_password === "t" ||
      member.is_initial_password === 1;

    console.log("login member.is_initial_password:", member.is_initial_password);

    if (mustChangePassword) {
      router.push("/change_password");
      return;
    }

    router.push("/home");
  };

  return (
    <div className="min-h-dvh bg-black text-zinc-50 px-3.5 py-9 flex items-center justify-center">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 -z-10 rounded-[1.8rem] bg-[radial-gradient(ellipse_at_top,_rgba(236,72,153,0.20),transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.14),transparent_50%)]" />

        <div className="rounded-[1.8rem] border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-[1.35rem] sm:p-[1.8rem]">
          <div className="text-center">
            <h1 className="mt-[1.125rem] text-[2.2rem] sm:text-[3.0rem] font-black tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300">
                Kroove
              </span>
            </h1>
            <p className="mt-0 text-[0.88rem] sm:text-[1.0rem] text-zinc-400">
              Kakao Dance Crew
            </p>
          </div>

          <form className="mt-[1.35rem]" onSubmit={handleSubmit}>
            <div className="space-y-[0.9rem]">
              <div>
                <label
                  htmlFor="l-dap"
                  className="sr-only"
                >
                  L.dap
                </label>
                <input
                  id="l-dap"
                  name="l-dap"
                  value={lDap}
                  onChange={(e) => setLDap(e.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  placeholder="L.dap"
                  className="w-full rounded-[0.675rem] bg-zinc-800/60 border border-white/10 px-[0.9rem] py-[0.68rem] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="sr-only"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="password"
                  className="w-full rounded-[0.675rem] bg-zinc-800/60 border border-white/10 px-[0.9rem] py-[0.68rem] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-[1.35rem] w-full rounded-[0.675rem] bg-gradient-to-r from-fuchsia-500 to-violet-500 px-[1.125rem] py-[0.79rem] font-semibold text-white shadow-[0_14px_40px_rgba(192,132,252,0.35)] hover:brightness-110 active:brightness-95 disabled:opacity-70 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "로그인 중..." : "로그인"}
            </button>

            {error ? (
              <p className="mt-[0.9rem] text-center text-[0.8rem] font-semibold text-red-500">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
