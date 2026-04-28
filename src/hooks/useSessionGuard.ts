"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type SessionMember = {
  ldap?: string | null;
  role?: "member" | "manager" | "head" | null;
};

type AuthMeResponse = {
  member?: SessionMember;
};

type UseSessionGuardOptions = {
  redirectTo?: string;
  onAuthorized?: (member: SessionMember) => void;
  onUnauthorized?: () => void;
};

export function useSessionGuard(options?: UseSessionGuardOptions) {
  const router = useRouter();
  const redirectTo = options?.redirectTo ?? "/";
  const [isSessionChecking, setIsSessionChecking] = useState(true);
  const redirectNow = useCallback(() => {
    if (window.location.pathname !== redirectTo) {
      window.location.replace(redirectTo);
    } else {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  const validateSession = useCallback(async () => {
    const response = await fetch("/api/auth/me", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      options?.onUnauthorized?.();
      setIsSessionChecking(false);
      redirectNow();
      return;
    }

    const json = (await response.json()) as AuthMeResponse;
    const member = json.member ?? {};

    if (!member.ldap) {
      options?.onUnauthorized?.();
      setIsSessionChecking(false);
      redirectNow();
      return;
    }

    options?.onAuthorized?.(member);
    setIsSessionChecking(false);
  }, [options, redirectNow]);

  useEffect(() => {
    const onFocus = () => {
      void validateSession();
    };
    const onPageShow = () => {
      void validateSession();
    };

    void validateSession();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [validateSession]);

  return { isSessionChecking, validateSession };
}
