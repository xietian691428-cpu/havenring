"use client";

import { useEffect, useState } from "react";
import AppShell from "@/src/app-shell/AppShell";
import { isFirstMemoryCompleted } from "@/src/services/firstRunTelemetryService";

const ONBOARDING_DONE_KEY = "haven.onboarding.completed.v1";
const FTUX_STARTED_KEY = "haven.ftux.started.v1";

export default function AppHomePage() {
  const [canRenderApp, setCanRenderApp] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const onboardingDone = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
    const firstMemoryDone = isFirstMemoryCompleted();
    const startedFromStart = window.localStorage.getItem(FTUX_STARTED_KEY) === "1";
    if (!startedFromStart && (!onboardingDone || !firstMemoryDone)) {
      setRedirecting(true);
      window.location.replace("/start");
      return;
    }
    if (startedFromStart) {
      window.localStorage.removeItem(FTUX_STARTED_KEY);
    }
    setCanRenderApp(true);
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
