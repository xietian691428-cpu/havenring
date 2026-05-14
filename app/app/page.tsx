"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import AppShell from "@/src/app-shell/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isFirstMemoryCompleted } from "@/src/services/firstRunTelemetryService";

const ONBOARDING_DONE_KEY = "haven.onboarding.completed.v1";
const FTUX_STARTED_KEY = "haven.ftux.started.v1";

function isPermanentSession(session: Session | null): session is Session {
  if (!session) return false;
  return (
    session.user.is_anonymous !== true &&
    session.user.app_metadata?.provider !== "anonymous"
  );
}

function appUrlLooksLikeAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  if (
    hash.includes("access_token=") ||
    hash.includes("error=") ||
    hash.includes("error_description=")
  ) {
    return true;
  }
  return new URLSearchParams(window.location.search).has("code");
}

export default function AppHomePage() {
  const [canRenderApp, setCanRenderApp] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const onboardingDone = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
    const firstMemoryDone = isFirstMemoryCompleted();
    const startedFromStart = window.localStorage.getItem(FTUX_STARTED_KEY) === "1";

    const mightNeedStartRedirect =
      !startedFromStart && (!onboardingDone || !firstMemoryDone);
    const needsSessionProbe = mightNeedStartRedirect || appUrlLooksLikeAuthCallback();

    if (!needsSessionProbe) {
      queueMicrotask(() => {
        if (cancelled) return;
        if (startedFromStart) {
          window.localStorage.removeItem(FTUX_STARTED_KEY);
        }
        setCanRenderApp(true);
        void getSupabaseBrowserClient().auth.initialize();
      });
      return () => {
        cancelled = true;
      };
    }

    const supabase = getSupabaseBrowserClient();

    void (async () => {
      await supabase.auth.initialize();
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const started = window.localStorage.getItem(FTUX_STARTED_KEY) === "1";
      const onboarding = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
      const firstMemory = isFirstMemoryCompleted();

      if (isPermanentSession(data.session ?? null)) {
        if (started) {
          window.localStorage.removeItem(FTUX_STARTED_KEY);
        }
        setCanRenderApp(true);
        return;
      }

      if (!started && (!onboarding || !firstMemory)) {
        setRedirecting(true);
        window.location.replace("/start");
        return;
      }
      if (started) {
        window.localStorage.removeItem(FTUX_STARTED_KEY);
      }
      setCanRenderApp(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!canRenderApp) {
    return redirecting ? (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#120f0e",
          color: "#d9c3b3",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Preparing your memory sanctuary...
      </main>
    ) : null;
  }
  return <AppShell />;
}
