"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
        await sb.auth.initialize();
      } catch {
        /* offline / blocked — still read any persisted session */
      }
      if (cancelled) return;
      const { data } = await sb.auth.getSession();
      if (!cancelled) {
        setSession(data.session ?? null);
        setLoading(false);
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
