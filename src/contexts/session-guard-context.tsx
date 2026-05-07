"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SessionMember = {
  ldap?: string | null;
  role?: "member" | "manager" | "head" | null;
};

type AuthMeResponse = {
  member?: SessionMember;
};

type SessionStatus = "checking" | "authenticated" | "unauthorized";

type SessionGuardContextValue = {
  status: SessionStatus;
  member: SessionMember | null;
  validateSession: (options?: { force?: boolean }) => Promise<SessionMember | null>;
};

export const SessionGuardContext = createContext<SessionGuardContextValue | null>(null);

const SESSION_VALIDATE_THROTTLE_MS = 15000;

export function SessionGuardProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [member, setMember] = useState<SessionMember | null>(null);
  const memberRef = useRef<SessionMember | null>(null);
  const inFlightRef = useRef<Promise<SessionMember | null> | null>(null);
  const lastCheckedAtRef = useRef<number>(0);

  useEffect(() => {
    memberRef.current = member;
  }, [member]);

  const validateSession = useCallback(async (options?: { force?: boolean }) => {
    const force = Boolean(options?.force);
    const now = Date.now();
    const isFresh = now - lastCheckedAtRef.current < SESSION_VALIDATE_THROTTLE_MS;

    if (!force && isFresh) {
      return memberRef.current;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const run = (async () => {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        cache: "no-store",
      });

      lastCheckedAtRef.current = Date.now();

      if (!response.ok) {
        setMember(null);
        setStatus("unauthorized");
        return null;
      }

      const json = (await response.json()) as AuthMeResponse;
      const nextMember = json.member ?? null;

      if (!nextMember?.ldap) {
        setMember(null);
        setStatus("unauthorized");
        return null;
      }

      setMember(nextMember);
      setStatus("authenticated");
      return nextMember;
    })();

    inFlightRef.current = run;
    try {
      return await run;
    } finally {
      inFlightRef.current = null;
    }
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void validateSession();
    };
    const onPageShow = () => {
      void validateSession();
    };

    void validateSession({ force: true });
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [validateSession]);

  const value = useMemo<SessionGuardContextValue>(
    () => ({
      status,
      member,
      validateSession,
    }),
    [member, status, validateSession]
  );

  return <SessionGuardContext.Provider value={value}>{children}</SessionGuardContext.Provider>;
}
