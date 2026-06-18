"use client";

import { useEffect, useState, type ReactNode } from "react";
import { deferEntryWork, isLowMemoryEntryDevice } from "@/lib/entry-defer";
import { RingProvider } from "../providers/RingProvider";
import { SessionProvider, useSessionContext } from "../providers/SessionProvider";
import { SubscriptionProvider } from "../providers/SubscriptionProvider";
import { AppFlowProvider } from "../state/appFlowContext";
import { AppRouter } from "./AppRouter";
import { AppEntrySkeleton } from "./AppEntrySkeleton";
import { SessionOrStartRedirect } from "./SessionOrStartRedirect";

function DeferredAppProviders({ children }: { children: ReactNode }) {
  const { sessionLoading } = useSessionContext();
  const [heavyReady, setHeavyReady] = useState(!isLowMemoryEntryDevice());

  useEffect(() => {
    if (!isLowMemoryEntryDevice()) {
      setHeavyReady(true);
      return undefined;
    }
    if (sessionLoading) return undefined;
    let active = true;
    deferEntryWork(
      () => {
        if (active) setHeavyReady(true);
      },
      { timeout: 1200 }
    );
    return () => {
      active = false;
    };
  }, [sessionLoading]);

  if (!heavyReady) {
    return <AppEntrySkeleton />;
  }

  return (
    <SubscriptionProvider>
      <RingProvider>{children}</RingProvider>
    </SubscriptionProvider>
  );
}

/** Root Haven PWA shell: staged init to avoid iOS WebKit OOM on first /app paint. */
export default function AppShell() {
  const [bootReady, setBootReady] = useState(!isLowMemoryEntryDevice());

  useEffect(() => {
    if (!isLowMemoryEntryDevice()) return undefined;
    let active = true;
    deferEntryWork(
      () => {
        if (active) setBootReady(true);
      },
      { timeout: 500 }
    );
    return () => {
      active = false;
    };
  }, []);

  if (!bootReady) {
    return <AppEntrySkeleton />;
  }

  return (
    <AppFlowProvider>
      <SessionProvider>
        <SessionOrStartRedirect>
          <DeferredAppProviders>
            <AppRouter />
          </DeferredAppProviders>
        </SessionOrStartRedirect>
      </SessionProvider>
    </AppFlowProvider>
  );
}
