"use client";

import { useEffect, useState } from "react";
import AppShell from "@/src/app-shell/AppShell";
import {
  captureAppDeepLinkForPostLogin,
  FTUX_STARTED_KEY,
  isPermanentSupabaseSession,
  scrubSupabaseAuthArtifactsFromAppUrl,
} from "@/lib/appAuthGate";
import { urlLooksLikeSupabaseAuthReturn } from "@/lib/supabaseAuthUrlSignal";
import { useSupabaseSession } from "@/src/hooks/useSupabaseSession";

export default function AppHomePage() {
  const { session, loading } = useSupabaseSession();
  const ready = isPermanentSupabaseSession(session);
  const [redirecting, setRedirecting] = useState(false);
  const [authReturnPending, setAuthReturnPending] = useState(
    () => typeof window !== "undefined" && urlLooksLikeSupabaseAuthReturn()
  );

  useEffect(() => {
    if (!authReturnPending) return undefined;
    if (ready) {
      setAuthReturnPending(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setAuthReturnPending(false), 14_000);
    return () => window.clearTimeout(timer);
  }, [authReturnPending, ready]);

  useEffect(() => {
    if (loading || authReturnPending) return;
    if (ready) {
      try {
        window.localStorage.removeItem(FTUX_STARTED_KEY);
      } catch {
        /* ignore */
      }
      scrubSupabaseAuthArtifactsFromAppUrl();
      return;
    }
    if (urlLooksLikeSupabaseAuthReturn()) return;
    captureAppDeepLinkForPostLogin();
    queueMicrotask(() => setRedirecting(true));
    window.location.replace("/login?next=%2Fapp");
  }, [loading, ready, authReturnPending]);

  useEffect(() => {
    if (!loading || ready || authReturnPending) return undefined;
    if (urlLooksLikeSupabaseAuthReturn()) return undefined;
    const timer = window.setTimeout(() => {
      captureAppDeepLinkForPostLogin();
      window.location.replace("/login?next=%2Fapp");
    }, 14_000);
    return () => window.clearTimeout(timer);
  }, [loading, ready, authReturnPending]);

  if (loading || authReturnPending || !ready) {
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
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#f8efe7" }}>
            {loading ? "Opening Haven…" : redirecting ? "Sign in required" : "Opening Haven…"}
          </p>
        </div>
      </main>
    );
  }

  return <AppShell />;
}
