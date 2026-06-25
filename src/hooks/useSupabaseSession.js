"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { withTimeout } from "@/lib/nfc-flow-timing";

const AUTH_INIT_TIMEOUT_MS = 8_000;

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
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
