"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/nfc-flow-timing";
import { urlLooksLikeSupabaseAuthReturn } from "@/lib/supabaseAuthUrlSignal";

const AUTH_INIT_TIMEOUT_MS = 8_000;
const AUTH_RETURN_MAX_WAIT_MS = 14_000;

/**
 * Tracks Supabase auth session in the PWA shell (for silent NFC login UX).
 * Calls `initialize()` first so `/app` OAuth callbacks and persisted sessions agree.
 */
export function useSupabaseSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    let cancelled = false;
    const authReturnPending =
      typeof window !== "undefined" && urlLooksLikeSupabaseAuthReturn();
    let authReturnTimer;

    void (async () => {
      try {
        await withTimeout(
          sb.auth.initialize(),
          AUTH_INIT_TIMEOUT_MS,
          "Auth init timed out"
        );
      } catch {
        /* offline / blocked — still read any persisted session */
      }
      if (cancelled) return;
      try {
        const { data } = await withTimeout(
          sb.auth.getSession(),
          AUTH_INIT_TIMEOUT_MS,
          "Auth session timed out"
        );
        if (!cancelled) {
          setSession(data.session ?? null);
          if (!authReturnPending || data.session) {
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled && !authReturnPending) {
          setLoading(false);
        }
      }
    })();

    if (authReturnPending) {
      authReturnTimer = window.setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, AUTH_RETURN_MAX_WAIT_MS);
    }

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (authReturnTimer !== undefined) {
        window.clearTimeout(authReturnTimer);
      }
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
