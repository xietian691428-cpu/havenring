"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getPreferredLocale, getTranslator } from "@/lib/i18n";
import {
  hydrateHavenStore,
  useHavenStore,
  type PendingMoment,
} from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  clearPendingMomentSnapshot,
  readPendingMomentSnapshot,
} from "@/lib/pending-moment";
import {
  getSecuritySummary,
  hasRingAccessGrant,
  requiresReverificationCurrentDevice,
} from "@/src/services/deviceTrustService";

type HubState =
  | { kind: "deciding" }
  | { kind: "error"; message: string };

export function HubRouter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const locale = getPreferredLocale(searchParams);
  const t = getTranslator(locale);
  const nfcUnavailableParam = searchParams.get("nfc") === "unavailable";
  const permissionDeniedParam = searchParams.get("nfc") === "denied";
  const fallbackToHome = useCallback(
    (reason: string) => {
      const next = new URL("/", window.location.origin);
      next.searchParams.set("ring", "signin");
      next.searchParams.set("reason", reason);
      next.searchParams.set("lang", locale);
      if (token) next.searchParams.set("token", token);
      router.replace(`${next.pathname}${next.search}`);
    },
    [locale, router, token]
  );

  const [state, setState] = useState<HubState>(() =>
    token
      ? { kind: "deciding" }
      : { kind: "error", message: t("hub.error.missing_token") }
  );
  const didRun = useRef(false);

  const clearPending = useHavenStore((s) => s.clearPending);
  const setStage = useHavenStore((s) => s.setStage);
  const grantVaultAccess = useHavenStore((s) => s.grantVaultAccess);
  const setClaimToken = useHavenStore((s) => s.setClaimToken);
  const setLinkedRingId = useHavenStore((s) => s.setLinkedRingId);

  useEffect(() => {
    hydrateHavenStore();
  }, []);

  useEffect(() => {
    if (!token) return;
    // Minimize token exposure in browser history/UI as early as possible.
    const scrubbed = new URL(window.location.href);
    scrubbed.searchParams.delete("token");
    window.history.replaceState({}, "", scrubbed.toString());
  }, [token]);

  useEffect(() => {
    if (nfcUnavailableParam) {
      setClaimToken(null);
      fallbackToHome("nfc_unavailable");
      return;
    }
    if (permissionDeniedParam) {
      setClaimToken(null);
      fallbackToHome("permission_denied");
      return;
    }
  }, [nfcUnavailableParam, permissionDeniedParam, setClaimToken, fallbackToHome]);

  useEffect(() => {
    if (!token) return;
    if (didRun.current) return;

    const decide = async (pending: PendingMoment | null) => {
      const supabase = getSupabaseBrowserClient();
      const effectivePending = pending ?? readPendingMomentSnapshot();
      const security = getSecuritySummary();
      if (!security.initialized) {
        fallbackToHome("device_setup_required");
        return;
      }
      if (!security.trustedCurrentDevice) {
        const granted = await hasRingAccessGrant(token);
        if (!granted) {
          fallbackToHome("device_verification_required");
          return;
        }
      }
      if (security.trustedCurrentDevice && requiresReverificationCurrentDevice()) {
        const granted = await hasRingAccessGrant(token);
        if (!granted) {
          fallbackToHome("device_verification_required");
          return;
        }
      }

      // Scenario A: there's something waiting to be sealed on this device.
      if (effectivePending) {
        try {
          const { error } = await supabase.rpc("seal_moment" as never, {
            p_moment_id: effectivePending.momentId,
            p_token: token,
          } as never);
          if (error) {
            setState({ kind: "error", message: error.message });
            return;
          }

          clearPending();
          clearPendingMomentSnapshot();
          setStage("sealed");
          router.replace("/seal-success");
          return;
        } catch (err) {
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "Unknown error.",
          });
          return;
        }
      }

      // Scenario B: nothing pending — user wants to revisit sealed moments.
      try {
        const { data, error } = await supabase.rpc("resolve_ring_by_token" as never, {
          p_token: token,
        } as never);

        if (error || !data) {
          // Auto-claim fallback: if ring is prewritten but unclaimed and user is
          // authenticated, claim silently and continue.
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (accessToken) {
            const claimRes = await fetch("/api/rings/claim", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ token }),
            });

            if (claimRes.ok) {
              const retry = await supabase.rpc("resolve_ring_by_token", {
                p_token: token,
              });
              if (!retry.error && retry.data) {
                const claimedRingId = retry.data as unknown as string;
                setLinkedRingId(claimedRingId);
                grantVaultAccess(claimedRingId, token);
                router.replace(`/vault/${claimedRingId}`);
                return;
              }
            }
          }
          setClaimToken(null);
          fallbackToHome("ring_signin_required");
          return;
        }

        const ringId = data as unknown as string;
        setLinkedRingId(ringId);
        grantVaultAccess(ringId, token);
        router.replace(`/vault/${ringId}`);
      } catch (err) {
        fallbackToHome("ring_signin_required");
      }
    };

    const unsubscribe = useHavenStore.persist.onFinishHydration(
      (s: { pending: PendingMoment | null }) => {
        if (didRun.current) return;
        didRun.current = true;
        void decide(s.pending);
      }
    );

    if (useHavenStore.persist.hasHydrated()) {
      didRun.current = true;
      void decide(useHavenStore.getState().pending);
    }

    return () => {
      unsubscribe?.();
    };
  }, [
    token,
    router,
    clearPending,
    setStage,
    grantVaultAccess,
    setClaimToken,
    setLinkedRingId,
    locale,
    t,
    fallbackToHome,
  ]);

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white px-8">
      {state.kind === "deciding" && (
        <motion.p
          initial={{ opacity: 0.25 }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="text-sm tracking-[0.24em] uppercase text-white/70"
          aria-label="Working"
        >
          Authenticating
        </motion.p>
      )}

      {state.kind === "error" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <p className="text-sm tracking-[0.28em] uppercase text-white/80">
            {t("hub.error.title")}
          </p>
          <p className="max-w-sm text-base leading-relaxed text-white/85">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="text-sm tracking-[0.24em] uppercase text-white/80 hover:text-white transition-colors"
          >
            {t("common.return")}
          </button>
        </motion.div>
      )}
    </main>
  );
}
