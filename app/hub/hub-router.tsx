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
import { isSealFlowArmed } from "@/lib/seal-flow";

type HubState =
  | { kind: "deciding"; scene: "reading" | "seal" | "access" | "claim" }
  | { kind: "error"; message: string };

const HUB_SCENE_COPY = {
  en: {
    reading: {
      title: "Ring touch received",
      body: "Checking what this ring should do next.",
    },
    seal: {
      title: "Seal confirmation in progress",
      body: "This ring is physically confirming your sacred memory.",
    },
    access: {
      title: "Trusted ring access",
      body: "Opening the memories linked to this ring.",
    },
    claim: {
      title: "New ring binding",
      body: "Connecting this ring to your account.",
    },
  },
  fr: {
    reading: {
      title: "Bague detectee",
      body: "Nous verifions ce que cette bague doit faire.",
    },
    seal: {
      title: "Scellement en cours",
      body: "Cette bague confirme physiquement votre souvenir sacre.",
    },
    access: {
      title: "Acces par bague de confiance",
      body: "Ouverture des souvenirs lies a cette bague.",
    },
    claim: {
      title: "Liaison d'une nouvelle bague",
      body: "Connexion de cette bague a votre compte.",
    },
  },
  es: {
    reading: {
      title: "Anillo detectado",
      body: "Comprobando que debe hacer este anillo.",
    },
    seal: {
      title: "Confirmacion fisica de sello",
      body: "Este anillo esta confirmando tu recuerdo sagrado.",
    },
    access: {
      title: "Acceso con anillo de confianza",
      body: "Abriendo los recuerdos vinculados a este anillo.",
    },
    claim: {
      title: "Vinculando nuevo anillo",
      body: "Conectando este anillo a tu cuenta.",
    },
  },
  de: {
    reading: {
      title: "Ring erkannt",
      body: "Wir prüfen, was dieser Ring als Nächstes tun soll.",
    },
    seal: {
      title: "Versiegelung wird bestätigt",
      body: "Dieser Ring bestätigt deine heilige Erinnerung physisch.",
    },
    access: {
      title: "Zugriff mit vertrauenswürdigem Ring",
      body: "Erinnerungen dieses Rings werden geöffnet.",
    },
    claim: {
      title: "Neuen Ring verknüpfen",
      body: "Dieser Ring wird mit deinem Konto verbunden.",
    },
  },
  it: {
    reading: {
      title: "Anello rilevato",
      body: "Controlliamo cosa deve fare questo anello.",
    },
    seal: {
      title: "Conferma fisica del sigillo",
      body: "Questo anello sta confermando il tuo ricordo sacro.",
    },
    access: {
      title: "Accesso con anello fidato",
      body: "Apertura dei ricordi collegati a questo anello.",
    },
    claim: {
      title: "Collegamento nuovo anello",
      body: "Connessione di questo anello al tuo account.",
    },
  },
};

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
      next.searchParams.set(
        "ring",
        reason === "seal_not_ready" ? "sealhelp" : "signin"
      );
      next.searchParams.set("reason", reason);
      next.searchParams.set("lang", locale);
      if (token) next.searchParams.set("token", token);
      router.replace(`${next.pathname}${next.search}`);
    },
    [locale, router, token]
  );

  const [state, setState] = useState<HubState>(() =>
    token
      ? { kind: "deciding", scene: "reading" }
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
      const hasDraftSnapshot = Boolean(
        window.localStorage.getItem("haven.new_memory_draft")
      );
      if (hasDraftSnapshot && !isSealFlowArmed()) {
        fallbackToHome("seal_not_ready");
        return;
      }
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
        setState({ kind: "deciding", scene: "seal" });
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
      setState({ kind: "deciding", scene: "access" });
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
            setState({ kind: "deciding", scene: "claim" });
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
        <motion.div
          initial={{ opacity: 0.25 }}
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="max-w-sm rounded-3xl border border-white/15 bg-white/10 px-6 py-5 text-center shadow-2xl backdrop-blur"
          aria-label="Working"
        >
          <p className="text-xs tracking-[0.24em] uppercase text-white/55">
            Ring status
          </p>
          <p className="mt-3 text-base font-medium text-white/90">
            {(HUB_SCENE_COPY[locale as keyof typeof HUB_SCENE_COPY] || HUB_SCENE_COPY.en)[state.scene].title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            {(HUB_SCENE_COPY[locale as keyof typeof HUB_SCENE_COPY] || HUB_SCENE_COPY.en)[state.scene].body}
          </p>
        </motion.div>
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
