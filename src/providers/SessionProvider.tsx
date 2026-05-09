"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useSupabaseSession } from "../hooks/useSupabaseSession";

type SessionContextValue = {
  session: Session | null;
  sessionLoading: boolean;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSupabaseSession();
  const value = useMemo(
    () => ({ session, sessionLoading }),
    [session, sessionLoading]
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSessionContext must be used within SessionProvider.");
  }
  return ctx;
}
