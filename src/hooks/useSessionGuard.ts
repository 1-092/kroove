"use client";

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionGuardContext, type SessionMember } from "@/src/contexts/session-guard-context";

type UseSessionGuardOptions = {
  redirectTo?: string;
  onAuthorized?: (member: SessionMember) => void;
  onUnauthorized?: () => void;
};

export function useSessionGuard(options?: UseSessionGuardOptions) {
  const router = useRouter();
  const context = useContext(SessionGuardContext);
  const redirectTo = options?.redirectTo ?? "/";
  const onAuthorizedRef = useRef(options?.onAuthorized);
  const onUnauthorizedRef = useRef(options?.onUnauthorized);
  onAuthorizedRef.current = options?.onAuthorized;
  onUnauthorizedRef.current = options?.onUnauthorized;

  if (!context) {
    throw new Error("useSessionGuard must be used inside SessionGuardProvider");
  }

  const { status, member, validateSession } = context;

  const redirectNow = () => {
    if (window.location.pathname !== redirectTo) {
      window.location.replace(redirectTo);
    } else {
      router.replace(redirectTo);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && member?.ldap) {
      onAuthorizedRef.current?.(member);
      return;
    }
    if (status === "unauthorized") {
      onUnauthorizedRef.current?.();
      redirectNow();
    }
  }, [member, status, redirectTo, router]);

  return { isSessionChecking: status === "checking", validateSession };
}
