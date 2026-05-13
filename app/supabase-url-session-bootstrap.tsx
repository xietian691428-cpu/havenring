"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Ensures Supabase Auth runs `initialize()` on every route (including the
 * marketing home at `/`). Otherwise `getSupabaseBrowserClient()` is never
 * imported on `/`, so implicit OAuth `#access_token=...` is never parsed into
 * storage and the user stays “signed out”.
 */
export function SupabaseUrlSessionBootstrap() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const hadImplicitAuthFragment =
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      hash.includes("error_description=");
    const hadPkceCode = new URLSearchParams(window.location.search).has("code");

    const supabase = getSupabaseBrowserClient();

    void (async () => {
      try {
        await supabase.auth.initialize();
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;

        const path = window.location.pathname || "/";
        const cameFromAuthRedirect = hadImplicitAuthFragment || hadPkceCode;
        if (cameFromAuthRedirect && (path === "/" || path === "")) {
          router.replace("/app");
        }
      } catch {
        // URL may contain a non-Supabase fragment; ignore.
      }
    })();
  }, [router]);

  return null;
}
