"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { UserEntitlements } from "../features/subscription/subscriptionTypes";
import { useSubscriptionStatus } from "../hooks/useSubscriptionStatus";
import { useSessionContext } from "./SessionProvider";

type SubscriptionContextValue = {
  entitlements: UserEntitlements;
  subscriptionLoading: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { session } = useSessionContext();
  const { entitlements, loading } = useSubscriptionStatus(session);
  const value = useMemo(
    () => ({
      entitlements,
      subscriptionLoading: loading,
    }),
    [entitlements, loading]
  );
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error(
      "useSubscriptionContext must be used within SubscriptionProvider."
    );
  }
  return ctx;
}
