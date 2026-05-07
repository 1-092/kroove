"use client";

import { SessionGuardProvider } from "@/src/contexts/session-guard-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SessionGuardProvider>{children}</SessionGuardProvider>;
}
