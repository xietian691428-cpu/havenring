"use client";

import { useEffect, useState } from "react";
import AppShell from "@/src/app-shell/AppShell";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  appUrlLooksLikeSupabaseAuthCallback,
  captureAppDeepLinkForPostLogin,
  FTUX_STARTED_KEY,
  isPermanentSupabaseSession,
  scrubSupabaseAuthArtifactsFromAppUrl,
} from "@/lib/appAuthGate";

const AUTH_CALLBACK_RETRY_MS = 220;

export default function AppHomePage() {
  const [gatePhase, setGatePhase] = useState<"checking" | "redirecting" | "ready">("checking");

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowserClient();

    void (async () => {
      try {
        await supabase.auth.initialize();
      } catch {
        /* network / ad blockers — still try persisted session */
      }
      if (cancelled) return;

      let session = (await supabase.auth.getSession()).data.session ?? null;

      if (!isPermanentSupabaseSession(session) && appUrlLooksLikeSupabaseAuthCallback()) {
        await new Promise((r) => setTimeout(r, AUTH_CALLBACK_RETRY_MS));
        if (cancelled) return;
        session = (await supabase.auth.getSession()).data.session ?? null;
      }

      if (cancelled) return;

      if (isPermanentSupabaseSession(session)) {
        try {
          window.localStorage.removeItem(FTUX_STARTED_KEY);
        } catch {
          /* ignore */
        }
        scrubSupabaseAuthArtifactsFromAppUrl();
        setGatePhase("ready");
        return;
      }

      captureAppDeepLinkForPostLogin();
      setGatePhase("redirecting");
      window.location.replace("/start");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (gatePhase !== "ready") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#120f0e",
          color: "#d9c3b3",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
          maxWidth: 420,
          margin: "0 auto",
          lineHeight: 1.5,
        }}
      >
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {gatePhase === "redirecting" ? "Sign-in required" : "Private sanctuary"}
          </p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f8efe7" }}>
            {gatePhase === "redirecting"
              ? "Taking you to a secure sign-in…"
              : "Verifying your session…"}
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "#cbb09f" }}>
            {gatePhase === "redirecting"
              ? "Haven only opens after account sign-in. Ring links and invites are restored after you authenticate."
              : "Your memories stay off-limits until we confirm who you are. One moment."}
          </p>
        </div>
      </main>
    );
  }

  return <AppShell />;
}
