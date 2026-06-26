"use client";

import { useEffect, type ReactNode } from "react";
import { isPermanentSupabaseSession } from "@/lib/appAuthGate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlLooksLikeSupabaseAuthReturn } from "@/lib/supabaseAuthUrlSignal";
import { useSessionContext } from "../providers/SessionProvider";

const LOGIN_REDIRECT_GRACE_MS = 2_000;

/**
 * After the `/app` gate lets a signed-in user in, keep the shell private:
 * if Supabase drops to anonymous / signed-out, return to `/login` (not `/start`).
 * Grace period avoids iOS Apple OAuth racing session persistence after cache clear.
 */
export function SessionOrStartRedirect({ children }: { children: ReactNode }) {
  const { session, sessionLoading } = useSessionContext();

  useEffect(() => {
    if (sessionLoading) return;
    if (isPermanentSupabaseSession(session)) return;
    if (typeof window === "undefined") return;
    if (urlLooksLikeSupabaseAuthReturn()) return;

    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        try {
          const sb = getSupabaseBrowserClient();
          const { data } = await sb.auth.getSession();
          if (isPermanentSupabaseSession(data.session ?? null)) return;
        } catch {
          /* fall through */
        }
        if (!cancelled) {
          window.location.replace(`/login?next=${next}`);
        }
      })();
    }, LOGIN_REDIRECT_GRACE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session, sessionLoading]);

  return children;
}
