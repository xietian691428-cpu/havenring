"use client";

import { useEffect } from "react";

import type { Session } from "@supabase/supabase-js";

import { APP_ENTRY_PATH } from "@/lib/site";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** `/start` must stay mounted when claim or SDM params need StartClient logic. */
function startPageNeedsClientHandling(search: string): boolean {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const sp = new URLSearchParams(q);
  const claim = (sp.get("claim") || "").trim();
  if (claim) return true;
  const cmac = sp.get("cmac") || "";
  const picc = sp.get("picc") || sp.get("picc_data") || "";
  const uid = sp.get("uid") || "";
  const ctr = sp.get("ctr") || "";
  return Boolean(cmac) && (Boolean(picc) || (Boolean(uid) && Boolean(ctr)));
}

function normalizedPathname(): string {
  const raw = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function replaceWithAppShell() {
  const next = `${window.location.origin}${APP_ENTRY_PATH}`;
  if (window.location.href !== next) {
    window.location.replace(next);
  }
}

function shouldRedirectToAppAfterAuth(path: string, search: string): boolean {
  if (path === "/" || path === "") return true;
  if (path === "/start" && !startPageNeedsClientHandling(search)) return true;
  return false;
}

function tryOAuthReturnRedirect(session: Session | null): void {
  if (!session) return;
  const path = normalizedPathname();
  const search = window.location.search || "";
  if (shouldRedirectToAppAfterAuth(path, search)) {
    replaceWithAppShell();
  }
}

/**
 * Ensures Supabase Auth runs `initialize()` on every route (including the
 * marketing home at `/`). Otherwise `getSupabaseBrowserClient()` is never
 * imported on `/`, so implicit OAuth `#access_token=...` is never parsed into
 * storage and the user stays “signed out”.
 *
 * After OAuth, Supabase often returns to `/start#access_token=...` (FTUX).
 * We send users into `/app` with a **full document navigation** — on iOS
 * Safari / Home Screen PWA, `next/navigation` client transitions are less
 * reliable than `location.replace` right after auth.
 *
 * If `getSession()` is still empty once (race with `SIGNED_IN`), we listen
 * briefly for `SIGNED_IN` then redirect.
 */
export function SupabaseUrlSessionBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash || "";
    const hadImplicitAuthFragment =
      hash.includes("access_token=") ||
      hash.includes("error=") ||
      hash.includes("error_description=");
    const hadPkceCode = new URLSearchParams(window.location.search).has("code");
    const expectedAuthReturn = hadImplicitAuthFragment || hadPkceCode;

    const supabase = getSupabaseBrowserClient();

    let authUnsubscribe: (() => void) | undefined;
    let fallbackTimer: number | undefined;

    void (async () => {
      try {
        await supabase.auth.initialize();

        if (!expectedAuthReturn) return;

        const { data } = await supabase.auth.getSession();
        tryOAuthReturnRedirect(data.session ?? null);
        if (data.session) return;

        const { data: authData } = supabase.auth.onAuthStateChange((event, session) => {
          if (event !== "SIGNED_IN" || !session) return;
          tryOAuthReturnRedirect(session);
          if (fallbackTimer !== undefined) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = undefined;
          }
          authUnsubscribe?.();
          authUnsubscribe = undefined;
        });
        authUnsubscribe = () => authData.subscription.unsubscribe();

        fallbackTimer = window.setTimeout(() => {
          fallbackTimer = undefined;
          authUnsubscribe?.();
          authUnsubscribe = undefined;
        }, 10_000);
      } catch {
        // URL may contain a non-Supabase fragment; ignore.
      }
    })();

    return () => {
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      authUnsubscribe?.();
    };
  }, []);

  return null;
}
