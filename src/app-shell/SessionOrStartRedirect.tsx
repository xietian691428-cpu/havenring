"use client";

import { useEffect, type ReactNode } from "react";
import { isPermanentSupabaseSession } from "@/lib/appAuthGate";
import { useSessionContext } from "../providers/SessionProvider";

/**
 * After the `/app` gate lets a signed-in user in, keep the shell private:
 * if Supabase drops to anonymous / signed-out, return to `/login` (not `/start`).
 */
export function SessionOrStartRedirect({ children }: { children: ReactNode }) {
  const { session, sessionLoading } = useSessionContext();

  useEffect(() => {
    if (sessionLoading) return;
    if (isPermanentSupabaseSession(session)) return;
    if (typeof window === "undefined") return;
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.replace(`/login?next=${next}`);
  }, [session, sessionLoading]);

  return children;
}
