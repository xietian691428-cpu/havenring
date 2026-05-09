"use client";

import { RingProvider } from "../providers/RingProvider";
import { SessionProvider } from "../providers/SessionProvider";
import { SubscriptionProvider } from "../providers/SubscriptionProvider";
import { AppFlowProvider } from "../state/appFlowContext";
import { AppRouter } from "./AppRouter";

/** Root Haven PWA shell: flow machine, session, entitlement, ring stats, routing. */
export default function AppShell() {
  return (
    <AppFlowProvider>
      <SessionProvider>
        <SubscriptionProvider>
          <RingProvider>
            <AppRouter />
          </RingProvider>
        </SubscriptionProvider>
      </SessionProvider>
    </AppFlowProvider>
  );
}
