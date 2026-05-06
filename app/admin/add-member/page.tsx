"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSessionGuard } from "@/src/hooks/useSessionGuard";

type MemberRole = "member" | "manager" | "head";
type CrewMember = {
  id: string;
  ldap: string;
  name: string;
  role: MemberRole;
  status: "active" | "withdrawn";
};
const roleOptions: Array<{ value: MemberRole; label: string }> = [
  { value: "member", label: "회원" },
  { value: "manager", label: "운영진" },
  { value: "head", label: "회장" },
];

export default function AddMemberPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleChecking, setIsRoleChecking] = useState(true);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(true);
  const [openedRoleMenuMemberId, setOpenedRoleMenuMemberId] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);
  const [resettingPasswordMemberId, setResettingPasswordMemberId] = useState<string | null>(null);
  const [revealedWithdrawMemberId, setRevealedWithdrawMemberId] = useState<string | null>(null);
  const pointerStartXRef = useRef<number | null>(null);
  const pointerMemberIdRef = useRef<string | null>(null);
  const pointerIdRef = useRef<number | null>(null);

  useSessionGuard({
    onAuthorized: (member) => {
      if (!member.ldap || !["head", "manager"].includes(member.role ?? "")) {
        router.replace("/home");
        return;
      }
      setIsRoleChecking(false);
    },
    onUnauthorized: () => {
      setIsRoleChecking(true);
    },
  });

  useEffect(() => {
    if (isRoleChecking) return;

    const fetchMembers = async () => {
      setIsMembersLoading(true);
      const response = await fetch("/api/admin/members", { method: "GET" });
      const result = (await response.json()) as { members?: CrewMember[]; message?: string };
      if (!response.ok) {
        console.error("members fetch failed:", result.message);
        setMembers([]);
        setIsMembersLoading(false);
        return;
      }
      setMembers(result.members ?? []);
      setIsMembersLoading(false);
    };

    void fetchMembers();
  }, [isRoleChecking]);

  const resetForm = () => {
    setUserId("");
    setName("");
  };

  const roleLabel = (role: MemberRole) => {
    if (role === "head") return "회장";
    if (role === "manager") return "운영진";
    return "회원";
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedUserId = userId.trim();
    const trimmedName = name.trim();

    if (!trimmedUserId || !trimmedName) {
      alert("L.dap과 이름을 모두 입력해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: trimmedUserId,
          name: trimmedName,
          role: "member",
        }),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        alert(result.message ?? "추가에 실패했습니다.");
        return;
      }

      alert("추가 완료!");
      resetForm();
      setMembers((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          ldap: trimmedUserId,
          name: trimmedName,
          role: "member",
          status: "active",
        },
      ]);
    } catch {
      alert("추가 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeRole = async (memberId: string, nextRole: MemberRole) => {
    if (updatingRoleMemberId) return;

    setUpdatingRoleMemberId(memberId);
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: nextRole }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      alert(result.message ?? "회원구분 변경에 실패했습니다.");
      setUpdatingRoleMemberId(null);
      return;
    }

    setMembers((prev) =>
      prev.map((member) =>
        member.id === memberId ? { ...member, role: nextRole } : member
      )
    );
    setOpenedRoleMenuMemberId(null);
    setUpdatingRoleMemberId(null);
  };

  const handleWithdrawMember = async (memberId: string) => {
    const ok = window.confirm("탈퇴처리 하시겠습니까?");
    if (!ok) return;

    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, status: "withdrawn" }),
    });
    const result = (await response.json()) as { message?: string };

    if (!response.ok) {
      alert(result.message ?? "탈퇴 처리에 실패했습니다.");
      return;
    }

    setMembers((prev) => prev.filter((member) => member.id !== memberId));
    setRevealedWithdrawMemberId(null);
  };

  const handleResetPassword = async (memberId: string) => {
    if (resettingPasswordMemberId) return;
    const ok = window.confirm("비밀번호를 초기화 할까요?");
    if (!ok) return;

    setResettingPasswordMemberId(memberId);
    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, resetPassword: true }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) {
      alert(result.message ?? "비밀번호 초기화에 실패했습니다.");
      setResettingPasswordMemberId(null);
      return;
    }

    alert("비밀번호가 초기화 되었습니다.");
    setRevealedWithdrawMemberId(null);
    setResettingPasswordMemberId(null);
  };

  const applySwipeState = (memberId: string, deltaX: number) => {
    if (deltaX < -40) {
      setRevealedWithdrawMemberId(memberId);
    } else {
      setRevealedWithdrawMemberId(null);
    }
  };

  const isActionTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("[data-swipe-action='true']"));
  };

  return (
    <div className="min-h-dvh bg-black text-zinc-50 px-4 py-8">
      {isRoleChecking ? (
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            권한 확인 중...
          </div>
        </div>
      ) : (
      <div className="mx-auto w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-200 hover:bg-white/10 transition"
          aria-label="뒤로가기"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              d="M15 6L9 12L15 18"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300">
              크루원 추가
            </span>
          </h1>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div>
              <input
                id="user-id"
                name="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="l.dap"
                autoComplete="username"
                className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
              />
            </div>

            <div>
              <input
                id="name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름"
                className="w-full rounded-xl bg-zinc-800/60 border border-white/10 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/60 focus:border-fuchsia-400/40"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(56,189,248,0.35)] hover:brightness-110 active:brightness-95 disabled:opacity-70 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? "추가 중..." : "크루원 추가"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-zinc-900/60 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
          <h2 className="text-2xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300">
              크루원 관리
            </span>
          </h2>

          <div className="mt-4 space-y-2">
            {isMembersLoading ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-400">
                로딩 중...
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
                등록된 회원이 없습니다.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className={[
                    "relative rounded-xl border border-white/10 bg-zinc-900 touch-pan-y select-none",
                    openedRoleMenuMemberId === member.id ? "overflow-visible z-30" : "overflow-hidden",
                  ].join(" ")}
                  onPointerDown={(e) => {
                    if (isActionTarget(e.target)) return;
                    if (e.button !== undefined && e.button !== 0) return;
                    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
                    pointerIdRef.current = e.pointerId;
                    pointerStartXRef.current = e.clientX;
                    pointerMemberIdRef.current = member.id;
                  }}
                  onPointerUp={(e) => {
                    if (isActionTarget(e.target)) return;
                    if (pointerIdRef.current !== e.pointerId) return;
                    const startX = pointerStartXRef.current;
                    const memberId = pointerMemberIdRef.current;
                    if (startX === null || !memberId) return;
                    const deltaX = e.clientX - startX;
                    applySwipeState(memberId, deltaX);
                    pointerIdRef.current = null;
                    pointerStartXRef.current = null;
                    pointerMemberIdRef.current = null;
                  }}
                  onPointerCancel={() => {
                    pointerIdRef.current = null;
                    pointerStartXRef.current = null;
                    pointerMemberIdRef.current = null;
                  }}
                >
                  <button
                    data-swipe-action="true"
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={() => void handleWithdrawMember(member.id)}
                    className={[
                      "absolute right-0 top-0 z-20 h-full w-20 bg-zinc-600 text-xs font-bold text-white transition-opacity duration-150",
                      revealedWithdrawMemberId === member.id
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none",
                    ].join(" ")}
                  >
                    탈퇴
                  </button>
                  <button
                    data-swipe-action="true"
                    type="button"
                    onTouchStart={(e) => {
                      e.stopPropagation();
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={() => void handleResetPassword(member.id)}
                    className={[
                      "absolute right-20 top-0 z-20 h-full w-20 bg-sky-500 text-xs font-bold text-white transition-opacity duration-150",
                      revealedWithdrawMemberId === member.id
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none",
                    ].join(" ")}
                  >
                    {resettingPasswordMemberId === member.id ? "초기화..." : "초기화"}
                  </button>

                  <div
                    className={[
                      "relative z-10 flex items-center justify-between gap-3 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 transition-transform duration-200",
                      revealedWithdrawMemberId === member.id
                        ? "-translate-x-40"
                        : "translate-x-0",
                    ].join(" ")}
                  >
                    <span className="min-w-0 truncate text-left">
                      {member.ldap} ({member.name})
                    </span>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        disabled={updatingRoleMemberId === member.id}
                        onClick={() =>
                          setOpenedRoleMenuMemberId((prev) =>
                            prev === member.id ? null : member.id
                          )
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10 transition disabled:opacity-60"
                      >
                        {updatingRoleMemberId === member.id
                          ? "변경 중..."
                          : roleLabel(member.role)}
                      </button>
                      {openedRoleMenuMemberId === member.id ? (
                        <div className="absolute right-0 top-9 z-20 w-24 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                          {roleOptions.map((option) => (
                            <button
                              key={`${member.id}-${option.value}`}
                              type="button"
                              onClick={() => void handleChangeRole(member.id, option.value)}
                              className={[
                                "block w-full px-3 py-2 text-left text-xs transition",
                                member.role === option.value
                                  ? "bg-fuchsia-500/20 text-fuchsia-200"
                                  : "text-zinc-200 hover:bg-white/10",
                              ].join(" ")}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
