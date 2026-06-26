"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isPermanentSupabaseSession } from "@/lib/appAuthGate";
import { getBoundRingCount } from "../services/ringRegistryService";
import { hydrateRingRegistryFromCloud } from "../services/ringSyncService";
import { useSessionContext } from "./SessionProvider";

type RingContextValue = {
  boundRingCount: number;
  /** True after post-login cloud → local ring restore has finished. */
  ringHydrateSettled: boolean;
  bumpRingRegistry: () => void;
};

const RingContext = createContext<RingContextValue | null>(null);

const HYDRATE_RETRY_DELAYS_MS = [0, 600, 1400, 2800, 4500];

async function hydrateRingRegistryWithRetries(accessToken: string) {
  for (let i = 0; i < HYDRATE_RETRY_DELAYS_MS.length; i += 1) {
    if (HYDRATE_RETRY_DELAYS_MS[i]! > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, HYDRATE_RETRY_DELAYS_MS[i]);
      });
    }
    const outcome = await hydrateRingRegistryFromCloud(accessToken);
    if (outcome?.ok && outcome.ringCount > 0) {
      return outcome;
    }
    if (outcome?.ok && Number(outcome.ownedOnServer || 0) === 0) {
      return outcome;
    }
  }
  return hydrateRingRegistryFromCloud(accessToken);
}

export function RingProvider({ children }: { children: ReactNode }) {
  const { session, sessionLoading } = useSessionContext();
  const [version, setVersion] = useState(0);
  const [ringHydrateSettled, setRingHydrateSettled] = useState(
    () => getBoundRingCount() > 0
  );
  const hydratedForTokenRef = useRef("");

  const bumpRingRegistry = useCallback(() => {
    setVersion((v) => v + 1);
    setRingHydrateSettled(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onRegistryChange = () => {
      setVersion((v) => v + 1);
      setRingHydrateSettled(true);
    };
    window.addEventListener("haven-ring-registry", onRegistryChange);
    return () => {
      window.removeEventListener("haven-ring-registry", onRegistryChange);
    };
  }, []);

  useEffect(() => {
    if (sessionLoading) return undefined;
    if (!isPermanentSupabaseSession(session)) {
      hydratedForTokenRef.current = "";
      setRingHydrateSettled(getBoundRingCount() > 0);
      return undefined;
    }

    const token = String(session.access_token || "");
    if (!token) return undefined;

    if (hydratedForTokenRef.current === token && getBoundRingCount() > 0) {
      setRingHydrateSettled(true);
      return undefined;
    }

    let cancelled = false;
    setRingHydrateSettled(getBoundRingCount() > 0);

    void (async () => {
      await hydrateRingRegistryWithRetries(token);
      if (cancelled) return;
      hydratedForTokenRef.current = token;
      setVersion((v) => v + 1);
      setRingHydrateSettled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading]);

  const boundRingCount = useMemo(() => {
    void version;
    return getBoundRingCount();
  }, [version]);

  const value = useMemo(
    () => ({ boundRingCount, ringHydrateSettled, bumpRingRegistry }),
    [boundRingCount, ringHydrateSettled, bumpRingRegistry]
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
