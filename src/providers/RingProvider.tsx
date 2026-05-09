"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getBoundRingCount } from "../services/ringRegistryService";

type RingContextValue = {
  boundRingCount: number;
  bumpRingRegistry: () => void;
};

const RingContext = createContext<RingContextValue | null>(null);

export function RingProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bumpRingRegistry = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);
  const boundRingCount = useMemo(() => {
    void version;
    return getBoundRingCount();
  }, [version]);
  const value = useMemo(
    () => ({ boundRingCount, bumpRingRegistry }),
    [boundRingCount, bumpRingRegistry]
  );
  return <RingContext.Provider value={value}>{children}</RingContext.Provider>;
}

export function useRingRegistryContext(): RingContextValue {
  const ctx = useContext(RingContext);
  if (!ctx) {
    throw new Error("useRingRegistryContext must be used within RingProvider.");
  }
  return ctx;
}
