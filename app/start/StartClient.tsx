"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";
import { START_PAGE_CONTENT } from "@/src/content/startPageContent";
import { getPlatformGuidance } from "@/src/utils/platformGuidance";
import {
  abandonInProgressSealOnStartPage,
  finalizeSealChainFromSdmResponse,
  getSealSdmContextPayload,
} from "@/src/features/seal";
import { cacheSubscriptionStatus } from "@/src/services/subscriptionService";

const FTUX_STARTED_KEY = "haven.ftux.started.v1";
const PROD_ORIGIN = "https://havenring.me";
const CLAIM_REQUEST_TIMEOUT_MS = 10_000;

type SdmScene = "new_ring_binding" | "daily_access" | "seal_confirmation";

type SdmResolveState =
  | { kind: "idle" }
  | { kind: "resolving" }
  | {
      kind: "ready";
      scene: SdmScene;
      ringId: string | null;
      ownerId: string | null;
    }
  | { kind: "failed"; message: string };

function isSealNfcLaunchSearch(search: string): boolean {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const cmac = sp.get("cmac") || "";
  const picc = sp.get("picc") || sp.get("picc_data") || "";
  const uid = sp.get("uid") || "";
  const ctr = sp.get("ctr") || "";
  return Boolean(cmac) && (Boolean(picc) || (Boolean(uid) && Boolean(ctr)));
}

/** OAuth return URL: reads the live `/start` query so redirects never miss NFC params if the user signs in immediately. */
function buildOAuthReturnUrl(safeOrigin: string): string {
  if (typeof window === "undefined") return `${safeOrigin}/`;
  const rawSearch = window.location.search || "";
  const sp = new URLSearchParams(
    rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch
  );
  const claimRaw = sp.get("claim") || "";
  const claimNormalized = normalizeClaimValue(claimRaw);
  if (claimNormalized) {
    return `${safeOrigin}/start?claim=${encodeURIComponent(claimRaw.trim())}`;
  }
  if (isSealNfcLaunchSearch(rawSearch)) {
    const qs = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
    return qs ? `${safeOrigin}/start?${qs}` : `${safeOrigin}/start`;
  }
  return `${safeOrigin}/`;
}

function normalizeClaimValue(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "");
  if (!cleaned) return "";
  try {
    const decoded = decodeURIComponent(cleaned);
    if (/^https?:\/\//i.test(decoded)) {
      const url = new URL(decoded);
      return (url.searchParams.get("claim") || "").trim();
    }
    if (decoded.includes("claim=")) {
      const q = decoded.includes("?")
        ? decoded.slice(decoded.indexOf("?") + 1)
        : decoded;
      const p = new URLSearchParams(q);
      return (p.get("claim") || "").trim();
    }
    return decoded.trim();
  } catch {
    return cleaned;
  }
}

function getSdmSceneTitle(state: SdmResolveState) {
  if (state.kind === "resolving") return "Reading Ring — Verifying touch";
  if (state.kind === "failed") return "Ring Verification Failed";
  if (state.kind !== "ready") return "";
  if (state.scene === "new_ring_binding") {
    return "New Ring Detected — Ready to connect to your account";
  }
  if (state.scene === "seal_confirmation") {
    return "Ring Confirmed — Ready to seal your memory";
  }
  return "Trusted Ring — Welcome back to your sanctuary";
}

function getSdmSceneLabel(state: SdmResolveState) {
  if (state.kind === "resolving") return "Dynamic NFC touch received";
  if (state.kind === "failed") return "Verification blocked";
  if (state.kind !== "ready") return "";
  if (state.scene === "new_ring_binding") return "Scene: new ring binding";
  if (state.scene === "seal_confirmation") return "Scene: seal confirmation";
  return "Scene: daily access";
}

function getSdmSceneBody(state: SdmResolveState) {
  if (state.kind === "resolving") {
    return "Haven is verifying the dynamic NFC signature from this physical tap.";
  }
  if (state.kind === "failed") {
    return "This tap could not be trusted yet. Please touch the ring again.";
  }
  if (state.kind !== "ready") return "";
  if (state.scene === "new_ring_binding") {
    return "This verified ring is not connected to an account yet.";
  }
  if (state.scene === "seal_confirmation") {
    return "This verified ring belongs to you and is confirming the pending seal.";
  }
  return "This verified ring is already trusted and linked to an account.";
}

function getSdmNextStep(state: SdmResolveState) {
  if (state.kind === "resolving") {
    return "Next step: keep this page open while verification finishes.";
  }
  if (state.kind === "failed") {
    return state.message || "Next step: tap the ring again and keep it near the phone.";
  }
  if (state.kind !== "ready") return "";
  if (state.scene === "new_ring_binding") {
    return "Next step: sign in, then connect this ring to your account.";
  }
  if (state.scene === "seal_confirmation") {
    return "Next step: stay on this screen while Haven completes the seal.";
  }
  return "Next step: sign in or continue, then Haven opens the sanctuary for this ring.";
}

function getSdmCardStyle(state: SdmResolveState): CSSProperties {
  if (state.kind === "failed") return styles.sdmCardFailed;
  if (state.kind === "ready" && state.scene === "seal_confirmation") {
    return styles.sdmCardSeal;
  }
  if (state.kind === "ready" && state.scene === "daily_access") {
    return styles.sdmCardTrusted;
  }
  return styles.sdmCardNew;
}

function isSdmScene(scene: unknown): scene is SdmScene {
  return (
    scene === "new_ring_binding" ||
    scene === "daily_access" ||
    scene === "seal_confirmation"
  );
}

export default function StartClient() {
  const [busyProvider, setBusyProvider] = useState("");
  const [notice, setNotice] = useState("");
  const [appleProviderReady, setAppleProviderReady] = useState(true);
  const [claimToken, setClaimToken] = useState("");
  const [claimState, setClaimState] = useState<
    "idle" | "waiting_signin" | "claiming" | "claimed" | "failed" | "skipped"
  >("idle");
  const [sdmState, setSdmState] = useState<SdmResolveState>({ kind: "idle" });
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const guidance = useMemo(() => getPlatformGuidance(platform), [platform]);
  const hero = START_PAGE_CONTENT.hero;
  const hasVideoHero = Boolean(hero.video);
  const claimAttemptedRef = useRef(false);
  const pendingSealTapRef = useRef(false);

  function retrySdmTouch() {
    if (typeof window === "undefined") return;
    window.location.reload();
  }

  function continueWithoutRing() {
    if (typeof window === "undefined") return;
    abandonInProgressSealOnStartPage();
    window.location.assign("/app");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") || "";
    const ctr = params.get("ctr") || "";
    const cmac = params.get("cmac") || "";
    const picc = params.get("picc") || params.get("picc_data") || "";
    if (!cmac || (!picc && (!uid || !ctr))) return;
    const { context, draft_ids: pendingSealDraftIds } = getSealSdmContextPayload();
    pendingSealTapRef.current =
      Boolean(String(context || "").trim()) || pendingSealDraftIds.length > 0;

    const initialStateTimer = window.setTimeout(() => {
      setSdmState({ kind: "resolving" });
      setNotice("Reading ring status...");
    }, 0);

    const controller = new AbortController();
    const supabase = getSupabaseBrowserClient();
    void supabase.auth
      .getSession()
      .then(async ({ data: sessionData }) => {
        const accessToken = sessionData.session?.access_token || "";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        let res: Response;
        try {
          res = await fetch("/api/rings/sdm/resolve", {
            method: "POST",
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              uid,
              ctr,
              cmac,
              picc,
              context,
              draft_ids: pendingSealDraftIds,
            }),
          });
        } catch {
          throw new Error(
            "Could not reach Haven to verify this tap. Check your connection and try again — your draft stays on this device."
          );
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.valid !== true) {
          throw new Error(
            typeof data?.error === "string" && data.error
              ? data.error
              : "This ring could not be verified."
          );
        }
        const scene: SdmScene = isSdmScene(data.scene) ? data.scene : "daily_access";
        setSdmState({
          kind: "ready",
          scene,
          ringId: data.ringId || null,
          ownerId: data.ownerId || null,
        });
        setNotice(
          scene === "new_ring_binding"
            ? "New ring detected. Ready to connect."
            : scene === "seal_confirmation"
              ? "Ring confirmed. Sealing your memory."
              : "Trusted ring detected. Opening your sanctuary."
        );
        if (scene === "seal_confirmation") {
          if (!accessToken) {
            throw new Error("Please sign in, then touch your ring again to finish sealing.");
          }
          if (!data.sealTicket) {
            throw new Error("Ring confirmed. Return to your memory and tap Seal with Ring again.");
          }
          setNotice("Ring confirmed. Completing the seal...");
          await finalizeSealChainFromSdmResponse({
            sealTicket: String(data.sealTicket),
            draftIds: pendingSealDraftIds,
            accessToken,
          });
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const baseMsg =
          error instanceof Error ? error.message : "This ring could not be verified.";
        const sealHint = pendingSealTapRef.current
          ? " Sign in if needed, then open Capture again and touch your ring to retry sealing."
          : "";
        setSdmState({
          kind: "failed",
          message: `${baseMsg}${sealHint}`,
        });
        setNotice("Ring verification failed. Please try touching again.");
      });

    return () => {
      window.clearTimeout(initialStateTimer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = window.location.search
      ? new URLSearchParams(window.location.search).get("claim") || ""
      : "";
    const normalized = normalizeClaimValue(value);
    if (!normalized) return;
    const timer = window.setTimeout(() => {
      setClaimToken(normalized);
      setClaimState("waiting_signin");
      setNotice("Connecting your ring...");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (claimState !== "claimed") return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setClaimToken("");
      setNotice("30-Day Haven Plus activated! You can now try Seal with Ring.");
      window.history.replaceState({}, "", "/app");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [claimState]);

  useEffect(() => {
    if (claimState !== "claiming") return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      claimAttemptedRef.current = false;
      setClaimState("failed");
      setNotice(
        "Ring setup is taking too long. You can retry now, or continue without ring for now."
      );
    }, 12_000);
    return () => window.clearTimeout(timer);
  }, [claimState]);

  const claimRingWithToken = useCallback(async (accessToken: string) => {
    if (!claimToken || claimAttemptedRef.current) return;
    claimAttemptedRef.current = true;
    setClaimState("claiming");
    setNotice("Connecting your ring...");
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), CLAIM_REQUEST_TIMEOUT_MS);
      const res = await fetch("/api/rings/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
        body: JSON.stringify({ token: claimToken }),
      });
      window.clearTimeout(timer);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        claimAttemptedRef.current = false;
        setClaimState("failed");
        setNotice(
          typeof data?.error === "string" && data.error
            ? "We could not connect this ring yet. You can continue now and link it later."
            : "We could not connect this ring yet. You can continue without ring for now."
        );
        return;
      }
      if (data?.subscription) {
        cacheSubscriptionStatus(data.subscription);
      }
      setClaimState("claimed");
      setNotice(
        data?.plusTrialActivated
          ? "30-Day Haven Plus activated! You can now try Seal with Ring."
          : "Setup complete! You can now start saving memories."
      );
    } catch {
      claimAttemptedRef.current = false;
      setClaimState("failed");
      setNotice(
        "Ring setup timed out. You can retry now, or continue without ring for now."
      );
    }
  }, [claimToken]);

  useEffect(() => {
    if (!claimToken) return;
    const supabase = getSupabaseBrowserClient();
    let active = true;
    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session?.access_token) {
        void claimRingWithToken(data.session.access_token);
      } else {
        setClaimState("waiting_signin");
      }
    };
    void run();
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.access_token) {
        void claimRingWithToken(session.access_token);
      }
    });
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [claimRingWithToken, claimToken]);

  function getFriendlyAuthError(message: string, provider: "apple" | "google") {
    const normalized = String(message || "").toLowerCase();
    if (normalized.includes("provider is not enabled")) {
      if (provider === "apple") {
        return "Apple Sign In is not ready yet. Please continue with Google.";
      }
      return "Google Sign In is not ready yet. Please try Apple Sign In.";
    }
    return "Sign-in could not start. Please try again in a moment.";
  }

  async function signInWith(provider: "apple" | "google") {
    setBusyProvider(provider);
    setNotice("");
    try {
      window.localStorage.setItem(FTUX_STARTED_KEY, "1");
      const supabase = getSupabaseBrowserClient();
      const origin = window.location.origin || "";
      const safeOrigin =
        origin.includes("localhost") || origin.includes("127.0.0.1")
          ? PROD_ORIGIN
          : origin;
      const redirectTo = buildOAuthReturnUrl(safeOrigin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        if (
          provider === "apple" &&
          String(error.message || "")
            .toLowerCase()
            .includes("provider is not enabled")
        ) {
          setAppleProviderReady(false);
          setNotice("Apple Sign In is not ready yet. Redirecting to Google Sign In...");
          window.setTimeout(() => {
            void signInWith("google");
          }, 250);
          return;
        }
        setNotice(getFriendlyAuthError(error.message, provider));
      }
    } finally {
      setBusyProvider("");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.heroCard}>
        <div
          style={{
            ...styles.backdrop,
            backgroundImage: `linear-gradient(180deg, rgba(30,23,20,0.65), rgba(19,15,14,0.88)), url('${hero.image}')`,
          }}
        />
        {hasVideoHero ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={hero.poster || hero.image}
            style={styles.videoBackdrop}
          >
            <source src={hero.video} />
          </video>
        ) : null}
        <div style={styles.content}>
          <p style={styles.kicker}>Haven Ring</p>
          <h1 style={styles.title}>{guidance.startTitle}</h1>
          <p style={styles.subtitle}>{guidance.startSubtitle}</p>
          {sdmState.kind !== "idle" ? (
            <section
              style={{ ...styles.sdmCard, ...getSdmCardStyle(sdmState) }}
              role={sdmState.kind === "failed" ? "alert" : "status"}
              aria-live="polite"
            >
              <p style={styles.sdmEyebrow}>{getSdmSceneLabel(sdmState)}</p>
              <p style={styles.sdmTitle}>{getSdmSceneTitle(sdmState)}</p>
              <p style={styles.sdmBody}>{getSdmSceneBody(sdmState)}</p>
              <div style={styles.sdmNextStep}>
                <span style={styles.sdmNextLabel}>Next</span>
                <span>{getSdmNextStep(sdmState)}</span>
              </div>
              {sdmState.kind === "resolving" || sdmState.kind === "failed" ? (
                <div style={styles.sdmActions}>
                  {sdmState.kind === "failed" ? (
                    <button
                      type="button"
                      onClick={retrySdmTouch}
                      style={styles.sdmPrimaryAction}
                    >
                      Retry
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={continueWithoutRing}
                    style={styles.sdmSecondaryAction}
                  >
                    Continue without ring
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
          {claimToken ? (
            <section style={styles.claimCard}>
              <p style={styles.claimTitle}>Ring setup in progress</p>
              <p style={styles.claimBody}>
                {claimState === "claimed"
                  ? "Your ring is securely connected to your account."
                  : claimState === "waiting_signin"
                    ? "Please sign in first, then we will connect your ring automatically."
                    : "Connecting your ring..."}
              </p>
              {claimState === "failed" ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const supabase = getSupabaseBrowserClient();
                      const { data } = await supabase.auth.getSession();
                      if (data.session?.access_token) {
                        void claimRingWithToken(data.session.access_token);
                      } else {
                        setNotice("Please sign in first, then retry ring setup.");
                        setClaimState("waiting_signin");
                      }
                    } catch {
                      setNotice("Please sign in first, then retry ring setup.");
                      setClaimState("waiting_signin");
                    }
                  }}
                  style={styles.secondaryButton}
                >
                  Retry ring setup
                </button>
              ) : null}
              {claimState !== "claimed" ? (
                <button
                  type="button"
                  onClick={() => {
                    setClaimState("skipped");
                    setClaimToken("");
                    setNotice("You can continue now and connect a ring later in My Rings.");
                    if (typeof window !== "undefined") {
                      window.history.replaceState({}, "", "/app");
                    }
                  }}
                  style={styles.secondaryButton}
                >
                  Continue without ring for now
                </button>
              ) : null}
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => void signInWith("apple")}
            disabled={Boolean(busyProvider) || !appleProviderReady}
            style={styles.primaryButton}
          >
            {busyProvider === "apple"
              ? "Opening Apple Sign In..."
              : appleProviderReady
                ? "Continue with Apple"
                : "Apple Sign In coming soon"}
          </button>

          <button
            type="button"
            onClick={() => void signInWith("google")}
            disabled={Boolean(busyProvider)}
            style={styles.secondaryButton}
          >
            {busyProvider === "google"
              ? "Opening Google Sign In..."
              : "Continue with Google"}
          </button>
          <p style={styles.linkLine}>
            Already have an account?{" "}
            <Link href="/app" style={styles.link}>
              Sign in
            </Link>
          </p>
          <p style={styles.complianceLine}>
            By continuing, you agree to our{" "}
            <a href="/privacy-policy" style={styles.link}>
              Privacy Policy
            </a>
            .
          </p>
          {guidance.isIos ? (
            <section style={{ ...styles.tipCard, ...styles.tipCardIosStrong }}>
              <p style={styles.tipTitle}>iPhone tip</p>
              <p style={styles.tipBody}>
                In Safari, tap Share, then Add to Home Screen for the smoothest flow.
              </p>
            </section>
          ) : null}

          <p style={styles.notice}>{notice || "\u00A0"}</p>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    margin: 0,
    padding: 20,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(160deg, rgba(30,22,18,0.96) 0%, rgba(18,14,12,1) 55%, rgba(14,12,11,1) 100%)",
  },
  heroCard: {
    position: "relative",
    width: "100%",
    maxWidth: 760,
    borderRadius: 24,
    overflow: "hidden",
    border: "1px solid #4a372f",
    boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(30,23,20,0.65), rgba(19,15,14,0.88)), url('/start/hero-memory-sanctuary.svg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  videoBackdrop: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: 0.42,
    filter: "saturate(0.88) contrast(0.95)",
  },
  content: {
    position: "relative",
    padding: 28,
    display: "grid",
    gap: 14,
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  kicker: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    fontSize: 12,
    color: "#d9c3b3",
  },
  title: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1.25,
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    fontSize: 18,
    color: "#e7d2c3",
  },
  privacyLead: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.6,
    color: "#e8d7cb",
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "14px 18px",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "12px 16px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  linkLine: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 14,
  },
  complianceLine: {
    margin: 0,
    color: "#cbb09f",
    fontSize: 13,
    lineHeight: 1.5,
  },
  link: {
    color: "#f0c29e",
  },
  tipCard: {
    marginTop: 6,
    border: "1px solid #5a3b30",
    borderRadius: 14,
    background: "rgba(26, 20, 18, 0.8)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  tipCardIosStrong: {
    borderColor: "#d9a67a",
    boxShadow: "0 0 0 1px rgba(217,166,122,0.28) inset",
  },
  trustCard: {
    border: "1px solid #5a3b30",
    borderRadius: 14,
    background: "rgba(26, 20, 18, 0.8)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  trustTitle: {
    margin: 0,
    fontSize: 13,
    color: "#f0c29e",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  trustList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    lineHeight: 1.55,
  },
  tipTitle: {
    margin: 0,
    fontSize: 13,
    color: "#f0c29e",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },
  tipBody: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.5,
  },
  tipList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    lineHeight: 1.55,
  },
  tipFootnote: {
    margin: 0,
    color: "#cbb09f",
    fontSize: 12,
  },
  notice: {
    margin: 0,
    minHeight: 18,
    color: "#ffcab5",
    fontSize: 13,
  },
  claimCard: {
    border: "1px solid #d9a67a",
    borderRadius: 12,
    background: "rgba(48, 34, 27, 0.75)",
    padding: 12,
    display: "grid",
    gap: 8,
  },
  claimTitle: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 700,
  },
  claimBody: {
    margin: 0,
    color: "#f8efe7",
    lineHeight: 1.5,
    fontSize: 14,
  },
  sdmCard: {
    border: "1px solid #d9a67a",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(64, 43, 32, 0.96), rgba(28, 22, 19, 0.92))",
    padding: 18,
    display: "grid",
    gap: 10,
    boxShadow: "0 18px 46px rgba(0,0,0,0.32)",
  },
  sdmCardNew: {
    borderColor: "#e9b987",
    boxShadow:
      "0 18px 46px rgba(0,0,0,0.32), 0 0 0 1px rgba(233,185,135,0.28) inset",
  },
  sdmCardTrusted: {
    borderColor: "#9fd7bd",
    background:
      "linear-gradient(135deg, rgba(31, 64, 49, 0.86), rgba(24, 27, 23, 0.92))",
    boxShadow:
      "0 18px 46px rgba(0,0,0,0.32), 0 0 0 1px rgba(159,215,189,0.22) inset",
  },
  sdmCardSeal: {
    borderColor: "#f0c29e",
    background:
      "linear-gradient(135deg, rgba(82, 48, 35, 0.94), rgba(30, 22, 20, 0.94))",
    boxShadow:
      "0 18px 46px rgba(0,0,0,0.32), 0 0 0 1px rgba(240,194,158,0.34) inset",
  },
  sdmCardFailed: {
    borderColor: "#ff9d89",
    background:
      "linear-gradient(135deg, rgba(72, 29, 25, 0.92), rgba(30, 20, 18, 0.94))",
    boxShadow:
      "0 18px 46px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,157,137,0.26) inset",
  },
  sdmEyebrow: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    fontWeight: 800,
  },
  sdmTitle: {
    margin: 0,
    color: "#fff7ef",
    fontSize: 24,
    lineHeight: 1.18,
    fontWeight: 800,
  },
  sdmBody: {
    margin: 0,
    color: "#f8efe7",
    lineHeight: 1.55,
    fontSize: 15,
  },
  sdmNextStep: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 12,
    background: "rgba(255, 247, 239, 0.08)",
    padding: "10px 12px",
    display: "grid",
    gap: 4,
    color: "#fff7ef",
    lineHeight: 1.45,
    fontSize: 14,
  },
  sdmNextLabel: {
    color: "#f0c29e",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    fontWeight: 800,
  },
  sdmActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },
  sdmPrimaryAction: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  sdmSecondaryAction: {
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff7ef",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
};
