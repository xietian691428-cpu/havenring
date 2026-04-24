"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getPreferredLocale, getTranslator } from "@/lib/i18n";
import {
  hydrateHavenStore,
  useHavenStore,
  type PendingMoment,
} from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
      router.replace(`/claim?reason=nfc_unavailable&lang=${locale}`);
      return;
    }
    if (permissionDeniedParam) {
      setClaimToken(null);
      router.replace(`/claim?reason=permission_denied&lang=${locale}`);
      return;
    }
  }, [nfcUnavailableParam, permissionDeniedParam, router, locale, setClaimToken]);

  useEffect(() => {
    if (!token) return;
    if (didRun.current) return;

    const decide = async (pending: PendingMoment | null) => {
      const supabase = getSupabaseBrowserClient();

      // Scenario A: there's something waiting to be sealed on this device.
      if (pending) {
        try {
          const { error } = await supabase.rpc("seal_moment", {
            p_ring_id: pending.ringId,
            p_token: token,
          });

          if (error) {
            setState({ kind: "error", message: error.message });
            return;
          }

          clearPending();
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
        const { data, error } = await supabase.rpc("resolve_ring_by_token", {
          p_token: token,
        });

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
                grantVaultAccess(claimedRingId, token);
                router.replace(`/vault/${claimedRingId}`);
                return;
              }
            }
          }

          setClaimToken(token);
          router.replace(
            `/claim?reason=ring_inactive&lang=${locale}`
          );
          return;
        }

        const ringId = data as unknown as string;
        grantVaultAccess(ringId, token);
        router.replace(`/vault/${ringId}`);
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : t("hub.error.generic"),
        });
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
    locale,
    t,
  ]);

  return (
    <main className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white px-8">
      {state.kind === "deciding" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="h-px w-16 bg-white/60"
          aria-label="Working"
        />
      )}

      {state.kind === "error" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <p className="text-xs tracking-[0.3em] uppercase text-white/60">
            {t("hub.error.title")}
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-white/40">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="text-xs tracking-[0.3em] uppercase text-white/40 hover:text-white/70 transition-colors"
          >
            {t("common.return")}
          </button>
        </motion.div>
      )}
    </main>
  );
}
