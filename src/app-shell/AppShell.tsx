"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { deferEntryWork, isLowMemoryEntryDevice } from "@/lib/entry-defer";
import {
  consumeIosBootFromStartQuery,
  markIosAppBootStarted,
} from "@/lib/ios-app-boot";
import { refreshOomRiskSnapshot } from "@/lib/ios-memory-heuristics";
import { recordIosPageReload } from "@/lib/ios-reload-guard";
import { getMemoryCount } from "../features/memories/localMemoryStore";
import { RingProvider } from "../providers/RingProvider";
import { SessionProvider, useSessionContext } from "../providers/SessionProvider";
import { SubscriptionProvider } from "../providers/SubscriptionProvider";
import { AppFlowProvider } from "../state/appFlowContext";
import { AppEntrySkeleton } from "./AppEntrySkeleton";
import { SessionOrStartRedirect } from "./SessionOrStartRedirect";

const LazyAppRouter = dynamic(
  () => import("./AppRouter").then((mod) => mod.AppRouter),
  {
    ssr: false,
    loading: () => <AppEntrySkeleton />,
  }
);

function DeferredAppRouter() {
  const [routerReady, setRouterReady] = useState(!isLowMemoryEntryDevice());

  useEffect(() => {
    if (!isLowMemoryEntryDevice()) return undefined;
    let active = true;
    deferEntryWork(
      () => {
        if (active) setRouterReady(true);
      },
      { timeout: 2200 }
    );
    return () => {
      active = false;
    };
  }, []);

  if (!routerReady) {
    return <AppEntrySkeleton />;
  }

  return <LazyAppRouter />;
}

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
      { timeout: 1800 }
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
    consumeIosBootFromStartQuery();
    markIosAppBootStarted();
    recordIosPageReload();
    void refreshOomRiskSnapshot(getMemoryCount);
    if (!isLowMemoryEntryDevice()) return undefined;
    let active = true;
    deferEntryWork(
      () => {
        if (active) setBootReady(true);
      },
      { timeout: 700 }
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
            <DeferredAppRouter />
          </DeferredAppProviders>
        </SessionOrStartRedirect>
      </SessionProvider>
    </AppFlowProvider>
  );
}
