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

export default function AppHomePage() {
  const [canRenderApp, setCanRenderApp] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      await supabase.auth.initialize();
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const onboardingDone = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
      const firstMemoryDone = isFirstMemoryCompleted();
      const startedFromStart = window.localStorage.getItem(FTUX_STARTED_KEY) === "1";

      // Apple/Google return may hop www→apex before React; FTUX flag can stay on www while
      // session lands on apex — do not bounce a signed-in user back to /start.
      if (isPermanentSession(data.session ?? null)) {
        if (startedFromStart) {
          window.localStorage.removeItem(FTUX_STARTED_KEY);
        }
        setCanRenderApp(true);
        return;
      }

      if (!startedFromStart && (!onboardingDone || !firstMemoryDone)) {
        setRedirecting(true);
        window.location.replace("/start");
        return;
      }
      if (startedFromStart) {
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
