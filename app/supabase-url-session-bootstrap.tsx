"use client";

import { useEffect } from "react";

import type { Session } from "@supabase/supabase-js";

import { APP_ENTRY_PATH } from "@/lib/site";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { urlLooksLikeSupabaseAuthReturn } from "@/lib/supabaseAuthUrlSignal";

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
  if (path === "/" || path === "" || path === "/login") return false;
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
 * Ensures Supabase Auth runs on every route. When the URL clearly carries a
 * Supabase auth return, we **await** `initialize()` so tokens are parsed before
 * any child reads session; then we optionally send `/` or plain `/start` into
 * `/app` with `location.replace` (reliable on iOS PWA and Android Chrome).
 * The marketing site (`/`, `/login`) never auto-enters the app shell after OAuth.
 *
 * On all other navigations we only **kick** `initialize()` without blocking the
 * first paint so marketing and in-app routes stay snappy.
 */
export function SupabaseUrlSessionBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const expectedAuthReturn = urlLooksLikeSupabaseAuthReturn();

    const supabase = getSupabaseBrowserClient();

    if (!expectedAuthReturn) {
      void supabase.auth.initialize();
      return;
    }

    let authUnsubscribe: (() => void) | undefined;
    let fallbackTimer: number | undefined;

    void (async () => {
      try {
        await supabase.auth.initialize();

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
