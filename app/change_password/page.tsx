"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { supabase } from "@/src/lib/supabase";
import { useSessionGuard } from "@/src/hooks/useSessionGuard";

/** 로그인 화면 mock 초기 패스워드와 동일해야 함 */
const INITIAL_PASSWORD = "0000";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isSessionChecking } = useSessionGuard();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError("패스워드를 입력해주세요.");
      setIsSubmitting(false);
      return;
    }

    if (newPassword === INITIAL_PASSWORD) {
      setError("초기 패스워드는 사용할 수 없습니다.");
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("패스워드가 일치하지 않습니다.");
      setIsSubmitting(false);
      return;
    }

    const { error: updateAuthError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateAuthError) {
      console.error("비밀번호 변경(Auth) 실패:", updateAuthError.message);
      alert(`비밀번호 변경 중 오류가 발생했습니다: ${updateAuthError.message}`);
      setIsSubmitting(false);
      return;
    }

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      console.error("현재 사용자 조회 실패:", getUserError?.message);
      alert("현재 사용자 정보를 가져오지 못했습니다.");
      setIsSubmitting(false);
      return;
    }

    const markDoneResponse = await fetch("/api/auth/complete-password-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });

    if (!markDoneResponse.ok) {
      const result = (await markDoneResponse.json()) as { message?: string };
      console.error("members 업데이트 실패:", result.message);
      alert(`회원 정보 업데이트 중 오류가 발생했습니다: ${result.message ?? "unknown"}`);
      setIsSubmitting(false);
      return;
    }

    alert("비밀번호가 성공적으로 변경되었습니다!");
    router.push("/home");
  };

  return (
    <div className="min-h-dvh bg-black text-zinc-50 px-3.5 py-9 flex items-center justify-center">
      {isSessionChecking ? (
        <div className="w-full max-w-md rounded-[1.8rem] border border-white/10 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400">
          로그인 상태 확인 중...
        </div>
      ) : (
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 -z-10 rounded-[1.8rem] bg-[radial-gradient(ellipse_at_top,_rgba(236,72,153,0.20),transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(34,211,238,0.14),transparent_50%)]" />

        <div className="rounded-[1.8rem] border border-white/10 bg-zinc-900/60 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-[1.35rem] sm:p-[1.8rem]">
          <h1 className="text-center text-[1.1rem] sm:text-[1.2rem] font-bold text-zinc-100 tracking-tight">
            초기 패스워드 변경
          </h1>

          <form className="mt-[1.35rem]" onSubmit={handleSubmit}>
            <div className="space-y-[0.9rem]">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-zinc-200 mb-[0.45rem]"
                >
                  새 패스워드
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-[0.675rem] bg-zinc-800/60 border border-white/10 px-[0.9rem] py-[0.68rem] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                />
              </div>

              <div>
                <label

                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-zinc-200 mb-[0.45rem]"
                >
                  새 패스워드 확인
                </label>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-[0.675rem] bg-zinc-800/60 border border-white/10 px-[0.9rem] py-[0.68rem] text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-[1.35rem] w-full rounded-[0.675rem] bg-gradient-to-r from-fuchsia-500 to-violet-500 px-[1.125rem] py-[0.79rem] font-semibold text-white shadow-[0_14px_40px_rgba(192,132,252,0.35)] hover:brightness-110 active:brightness-95 transition"
            >
              {isSubmitting ? "변경 중..." : "변경하기"}
            </button>

            {error ? (
              <p className="mt-[0.9rem] text-center text-[0.8rem] font-semibold text-red-500">
                {error}
              </p>
            ) : null}
          </form>
        </div>
      </div>
      )}
    </div>
  );
}
