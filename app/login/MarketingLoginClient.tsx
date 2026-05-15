"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { canonicalAuthOriginFromLocation } from "@/lib/auth-redirect";
import {
  isPermanentSupabaseSession,
  scrubSupabaseAuthArtifactsFromEntryPages,
} from "@/lib/appAuthGate";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { APP_ENTRY_PATH, MARKETING_LOGIN_PATH } from "@/lib/site";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";

function readSafeNextPath(): string {
  if (typeof window === "undefined") return "/";
  const raw = new URLSearchParams(window.location.search).get("next")?.trim() || "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  try {
    const abs = new URL(raw, window.location.origin);
    if (abs.origin !== window.location.origin) return "/";
    if (/^\/(app|login|hub)(\/|$)/i.test(abs.pathname)) return "/";
    return abs.pathname + abs.search;
  } catch {
    return "/";
  }
}

function buildMarketingOAuthRedirectTo(): string {
  const base = canonicalAuthOriginFromLocation();
  const next = readSafeNextPath();
  if (next === "/") {
    return `${base}${MARKETING_LOGIN_PATH}`;
  }
  return `${base}${MARKETING_LOGIN_PATH}?next=${encodeURIComponent(next)}`;
}

function isOAuthProviderNotEnabledMessage(message: string): boolean {
  const raw = String(message || "");
  const lower = raw.toLowerCase();
  if (lower.includes("provider is not enabled")) return true;
  if (lower.includes("unsupported provider")) return true;
  if (raw.includes("提供程序未启用")) return true;
  if (raw.includes("不支持的提供程序")) return true;
  return false;
}

function friendlyOAuthError(message: string, provider: "apple" | "google"): string {
  if (isOAuthProviderNotEnabledMessage(message)) {
    if (provider === "apple") {
      return "Apple Sign In is not available yet. Please use Google.";
    }
    return "Google Sign In is not available yet. Please try Apple.";
  }
  return "Sign-in could not start. Please try again in a moment.";
}

export function MarketingLoginClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [appleReady, setAppleReady] = useState(true);
  const [nextHref, setNextHref] = useState("/");

  const platform = useMemo(() => resolvePlatformTarget(), []);

  useEffect(() => {
    setNextHref(readSafeNextPath());
    if (typeof window === "undefined") return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    void (async () => {
      try {
        await supabase.auth.initialize();
        if (cancelled) return;
        scrubSupabaseAuthArtifactsFromEntryPages();
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setSession(data.session ?? null);
      } catch {
        if (!cancelled) setNotice("Could not reach sign-in services. Check your connection.");
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signedIn = isPermanentSupabaseSession(session);

  const signOut = useCallback(async () => {
    setNotice("");
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const signInWith = useCallback(async (provider: "apple" | "google") => {
    setBusy(provider);
    setNotice("");
    try {
      const ua = navigator.userAgent.toLowerCase();
      const isAppleDevice =
        /iphone|ipad|ipod/.test(ua) ||
        (ua.includes("macintosh") && "ontouchend" in window);
      if (provider === "apple" && !isAppleDevice) {
        setNotice("Apple Sign In is only available on Apple devices. Please use Google.");
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const redirectTo = buildMarketingOAuthRedirectTo();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        if (
          provider === "apple" &&
          isOAuthProviderNotEnabledMessage(String(error.message || ""))
        ) {
          setAppleReady(false);
          setNotice("Apple Sign In is not ready yet. Opening Google…");
          window.setTimeout(() => void signInWith("google"), 280);
          return;
        }
        setNotice(friendlyOAuthError(String(error.message || ""), provider));
      }
    } finally {
      setBusy("");
    }
  }, []);

  return (
    <main className="min-h-[100svh] bg-[#0a0908] px-5 pb-16 pt-[calc(5.5rem+env(safe-area-inset-top))] text-[#f8efe7] sm:px-8">
      <div className="mx-auto max-w-md">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/55">HavenRing website</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {signedIn ? "You are signed in" : "Sign in to the website"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/58">
          {signedIn
            ? "Use the same account when you open the memory app. This page is for browsing the brand site, orders, and updates."
            : "For strangers and guests: sign in here to follow up on orders, the waitlist, and news. Your private memory sanctuary opens separately in the app."}
        </p>

        {signedIn ? (
          <div className="mt-10 grid gap-3">
            <Link
              href={nextHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-b from-[#e6b48d] to-[#c99562] px-6 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a1209]"
            >
              Continue browsing
            </Link>
            <Link
              href={APP_ENTRY_PATH}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/18 bg-white/[0.04] px-6 text-xs font-medium uppercase tracking-[0.18em] text-white/88 hover:border-amber-400/35"
            >
              Open memory app
            </Link>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 text-center text-[13px] text-white/45 underline-offset-4 hover:text-white/70 hover:underline"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-10 grid gap-3">
            <button
              type="button"
              disabled={Boolean(busy) || !appleReady}
              onClick={() => void signInWith("apple")}
              className="min-h-12 rounded-full border border-amber-400/40 bg-amber-400/[0.12] px-6 text-xs font-semibold uppercase tracking-[0.16em] text-amber-50/95 enabled:hover:border-amber-300/55 disabled:opacity-55"
            >
              {busy === "apple"
                ? "Opening Apple…"
                : appleReady
                  ? "Continue with Apple"
                  : "Apple unavailable"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void signInWith("google")}
              className="min-h-12 rounded-full border border-white/18 bg-white/[0.04] px-6 text-xs font-medium uppercase tracking-[0.16em] text-white/88 hover:border-amber-400/35 disabled:opacity-55"
            >
              {busy === "google" ? "Opening Google…" : "Continue with Google"}
            </button>
          </div>
        )}

        {platform === "android" && !signedIn ? (
          <p className="mt-6 text-xs leading-relaxed text-white/38">
            On Android, Google is usually the smoothest option for website sign-in.
          </p>
        ) : null}

        {notice ? <p className="mt-6 text-sm text-amber-100/85">{notice}</p> : null}

        <p className="mt-10 text-xs leading-relaxed text-white/35">
          Memory app sign-in (rings, sealing) uses{" "}
          <Link href="/start" className="text-amber-200/80 underline-offset-2 hover:underline">
            /start
          </Link>{" "}
          or{" "}
          <Link href={APP_ENTRY_PATH} className="text-amber-200/80 underline-offset-2 hover:underline">
            Open App
          </Link>
          — separate entry, same Haven account.
        </p>

        <p className="mt-6">
          <Link href="/" className="text-[13px] text-white/50 underline-offset-4 hover:text-white/75 hover:underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
