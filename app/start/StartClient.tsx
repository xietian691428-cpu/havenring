"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { canonicalAuthOriginFromLocation } from "@/lib/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";
import { START_PAGE_CONTENT } from "@/src/content/startPageContent";
import {
  START_PAGE_EN,
  getStartIdleHeroCopy,
  getStartSdmCardCopy,
  type HavenPlatform,
  type StartSdmScene,
  type StartSdmStateForCopy,
} from "@/src/content/havenCopy";
import {
  abandonInProgressSealOnStartPage,
  finalizeSealChainFromSdmResponse,
  getSealArmedRemainingMs,
  getSealSdmContextPayload,
  isSealFlowArmed,
} from "@/src/features/seal";
import { cacheSubscriptionStatus } from "@/src/services/subscriptionService";
import {
  consumeDeferredAppEntry,
  FTUX_STARTED_KEY,
  isPermanentSupabaseSession,
} from "@/lib/appAuthGate";

const CLAIM_REQUEST_TIMEOUT_MS = 10_000;

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
  if (typeof window === "undefined") {
    return `${safeOrigin}/start`;
  }
  const rawSearch = window.location.search || "";
  const sp = new URLSearchParams(
    rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch
  );
  const claimRaw = sp.get("claim") || "";
  const claimNormalized = normalizeClaimValue(claimRaw);
  if (claimNormalized) {
    return `${safeOrigin}/start?claim=${encodeURIComponent(claimRaw.trim())}`;
  }
  const uidOnly = (sp.get("uid") || "").trim();
  if (uidOnly && !sp.get("cmac")) {
    return `${safeOrigin}/bind-ring?uid=${encodeURIComponent(uidOnly)}`;
  }
  if (isSealNfcLaunchSearch(rawSearch)) {
    const qs = rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch;
    return qs ? `${safeOrigin}/start?${qs}` : `${safeOrigin}/start`;
  }
  return `${safeOrigin}/start`;
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

function getSdmCardStyle(state: StartSdmStateForCopy): CSSProperties {
  if (state.kind === "failed") return styles.sdmCardFailed;
  if (state.kind === "ready" && state.scene === "seal_confirmation") {
    return styles.sdmCardSeal;
  }
  if (state.kind === "ready" && state.scene === "daily_access") {
    const self = state.viewerUserId || "";
    const owner = state.ownerId || "";
    if (self && owner && self !== owner) {
      return styles.sdmCardFailed;
    }
    return styles.sdmCardTrusted;
  }
  return styles.sdmCardNew;
}

function isSdmScene(scene: unknown): scene is StartSdmScene {
  return (
    scene === "new_ring_binding" ||
    scene === "daily_access" ||
    scene === "seal_confirmation"
  );
}

function readInitialSdmState(): StartSdmStateForCopy {
  if (typeof window === "undefined") return { kind: "idle" };
  const raw = window.location.search || "";
  return isSealNfcLaunchSearch(raw) ? { kind: "resolving" } : { kind: "idle" };
}

function formatSealCountdown(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function NfcPhoneHint({ platform }: { platform: HavenPlatform }) {
  const stroke = "rgba(240,194,158,0.85)";
  const dim = "rgba(200,180,170,0.35)";
  if (platform === "ios") {
    return (
      <div style={styles.nfcDiagramWrap} aria-hidden>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.nfcSvg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="76" y="20" width="48" height="8" rx="3" fill={dim} />
          <path
            d="M100 20 L100 8 L130 8 L130 20"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="115" cy="14" r="5" fill="rgba(217,166,122,0.35)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Top — Dynamic Island / earpiece area
          </text>
        </svg>
      </div>
    );
  }
  if (platform === "android") {
    return (
      <div style={styles.nfcDiagramWrap} aria-hidden>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.nfcSvg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="72" y="22" width="56" height="36" rx="6" fill="none" stroke={dim} strokeWidth="1.5" />
          <circle cx="128" cy="40" r="10" fill="rgba(217,166,122,0.28)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Back — NFC often near camera
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div style={styles.nfcDiagramWrap} aria-hidden>
      <svg width="200" height="96" viewBox="0 0 200 96" style={styles.nfcSvg}>
        <rect x="48" y="8" width="104" height="80" rx="12" fill="none" stroke={dim} strokeWidth="2" />
        <circle cx="100" cy="48" r="14" fill="rgba(217,166,122,0.22)" stroke={stroke} strokeWidth="2" />
        <text x="100" y="88" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
          Hold near your device NFC reader
        </text>
      </svg>
    </div>
  );
}

function StartRingGlyphPulse() {
  return (
    <div style={styles.ringMarkWrap} aria-hidden>
      <span style={styles.ringHalo} />
      <svg width="76" height="76" viewBox="0 0 76 76" style={styles.ringSvg}>
        <circle cx="38" cy="38" r="24" fill="none" stroke="#e6b48d" strokeWidth="5.5" />
        <circle cx="38" cy="38" r="14" fill="none" stroke="#f0c29e" strokeWidth="2.5" opacity="0.55" />
      </svg>
    </div>
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
  const [sdmState, setSdmState] = useState<StartSdmStateForCopy>(() => readInitialSdmState());
  const platform = useMemo(() => resolvePlatformTarget() as HavenPlatform, []);
  const idleHero = useMemo(() => getStartIdleHeroCopy(platform), [platform]);
  const sdmCopy = useMemo(() => {
    if (sdmState.kind === "idle") return null;
    return getStartSdmCardCopy(platform, sdmState);
  }, [platform, sdmState]);
  const [sealLeaveGuard, setSealLeaveGuard] = useState(false);
  const [sealLeaveAck, setSealLeaveAck] = useState(false);
  const hero = START_PAGE_CONTENT.hero;
  const hasVideoHero = Boolean(hero.video);
  const claimAttemptedRef = useRef(false);
  const pendingSealTapRef = useRef(false);
  const bindRingRedirectDoneRef = useRef(false);
  const nfcSdmResolveGenerationRef = useRef(0);

  function retrySdmTouch() {
    if (typeof window === "undefined") return;
    setSealLeaveAck(false);
    window.location.reload();
  }

  const needsSealLeaveDouble =
    sealLeaveGuard &&
    (sdmState.kind === "resolving" ||
      sdmState.kind === "failed" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  const nfcFlow = sdmState.kind !== "idle";
  const sealTopBarMuted = nfcFlow && sealLeaveGuard;

  const showSealCountdown =
    sealLeaveGuard &&
    isSealFlowArmed() &&
    (sdmState.kind === "resolving" ||
      sdmState.kind === "failed" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  const [sealClockTick, setSealClockTick] = useState(0);
  useEffect(() => {
    if (!showSealCountdown) return;
    const id = window.setInterval(() => setSealClockTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [showSealCountdown]);

  const sealRemainingMs = useMemo(() => {
    void sealClockTick;
    return getSealArmedRemainingMs();
  }, [sealClockTick, showSealCountdown]);

  const isDailySelfOwner =
    sdmState.kind === "ready" &&
    sdmState.scene === "daily_access" &&
    Boolean(sdmState.viewerUserId && sdmState.ownerId && sdmState.viewerUserId === sdmState.ownerId);

  useEffect(() => {
    if (!isDailySelfOwner) return;
    const t = window.setTimeout(() => {
      window.location.assign("/app");
    }, 2000);
    return () => window.clearTimeout(t);
  }, [isDailySelfOwner]);

  const hideFtuxOAuthDuringSealTouch =
    nfcFlow &&
    (sdmState.kind === "resolving" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  function confirmLeaveWithoutRing() {
    if (typeof window === "undefined") return;
    setSealLeaveAck(false);
    abandonInProgressSealOnStartPage();
    window.location.assign("/app");
  }

  function onFooterContinueWithoutRing() {
    if (typeof window === "undefined") return;
    if (needsSealLeaveDouble && !sealLeaveAck) {
      setSealLeaveAck(true);
      return;
    }
    if (!needsSealLeaveDouble) {
      confirmLeaveWithoutRing();
    }
  }

  useEffect(() => {
    const id = "haven-start-ring-pulse-keyframes";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `@keyframes havenStartRingGlow{0%,100%{transform:scale(1);filter:drop-shadow(0 0 0 rgba(240,194,158,0))}50%{transform:scale(1.05);filter:drop-shadow(0 0 12px rgba(240,194,158,0.5))}}@keyframes havenStartRingHalo{0%{transform:scale(0.92);opacity:0.5}70%{transform:scale(1.4);opacity:0}100%{transform:scale(1.4);opacity:0}}`;
    document.head.appendChild(el);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid") || "";
    const ctr = params.get("ctr") || "";
    const cmac = params.get("cmac") || "";
    const picc = params.get("picc") || params.get("picc_data") || "";
    if (!cmac || (!picc && (!uid || !ctr))) return;
    const myGen = ++nfcSdmResolveGenerationRef.current;
    const { context, draft_ids: pendingSealDraftIds } = getSealSdmContextPayload();
    pendingSealTapRef.current =
      Boolean(String(context || "").trim()) || pendingSealDraftIds.length > 0;
    setSealLeaveGuard(pendingSealTapRef.current);

    const initialStateTimer = window.setTimeout(() => {
      setNotice(START_PAGE_EN.readingRingStatus);
    }, 0);

    const controller = new AbortController();
    const supabase = getSupabaseBrowserClient();
    void supabase.auth
      .getSession()
      .then(async ({ data: sessionData }) => {
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
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
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
        const data = await res.json().catch(() => ({}));
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
        if (!res.ok || data?.valid !== true) {
          throw new Error(
            typeof data?.error === "string" && data.error
              ? data.error
              : "This ring could not be verified."
          );
        }
        const scene: StartSdmScene = isSdmScene(data.scene) ? data.scene : "daily_access";
        const viewerUserId = sessionData.session?.user?.id ?? null;
        setSdmState({
          kind: "ready",
          scene,
          ringId: data.ringId || null,
          ownerId: data.ownerId || null,
          viewerUserId,
        });
        setNotice(
          scene === "new_ring_binding"
            ? "Status: not linked — you can connect this ring to one Haven account."
            : scene === "seal_confirmation"
              ? "Ring confirmed. Sealing your memory."
              : viewerUserId && data.ownerId && viewerUserId === data.ownerId
                ? "Status: already linked to your account."
                : viewerUserId && data.ownerId && viewerUserId !== data.ownerId
                  ? "Status: linked to another account — unlink there first to move it."
                  : "Status: already linked — sign in if this ring is yours."
        );
        if (scene === "seal_confirmation") {
          if (!accessToken) {
            throw new Error("Please sign in, then touch your ring again to finish sealing.");
          }
          if (!data.sealTicket) {
            throw new Error("Ring confirmed. Return to your memory and tap Seal with Ring again.");
          }
          if (myGen !== nfcSdmResolveGenerationRef.current) return;
          setNotice("Ring confirmed. Completing the seal...");
          await finalizeSealChainFromSdmResponse({
            sealTicket: String(data.sealTicket),
            draftIds: pendingSealDraftIds,
            accessToken,
          });
        }
      })
      .catch((error) => {
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
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
        setNotice(START_PAGE_EN.ringVerifyFailedNotice);
      });

    return () => {
      window.clearTimeout(initialStateTimer);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.includes("error=")) {
      try {
        const raw = hash.startsWith("#") ? hash.slice(1) : hash;
        const hp = new URLSearchParams(raw);
        const desc = hp.get("error_description") || hp.get("error") || "";
        const readable = desc
          ? decodeURIComponent(desc.replace(/\+/g, " "))
          : "Sign-in did not complete. Please try again.";
        setNotice(readable);
        const u = new URL(window.location.href);
        u.hash = "";
        window.history.replaceState({}, "", `${u.pathname}${u.search}`);
      } catch {
        setNotice("Sign-in did not complete. Please try again.");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSearch = window.location.search || "";
    if (isSealNfcLaunchSearch(rawSearch)) return;
    const claimProbe = new URLSearchParams(
      rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch
    ).get("claim") || "";
    if (normalizeClaimValue(claimProbe)) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    void (async () => {
      try {
        await supabase.auth.initialize();
      } catch {
        /* continue */
      }
      if (cancelled) return;
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!isPermanentSupabaseSession(data.session ?? null)) return;
      const nextPath = consumeDeferredAppEntry();
      if (!nextPath) return;
      window.location.assign(`${window.location.origin}${nextPath}`);
    })();
    return () => {
      cancelled = true;
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
      setNotice("Connecting your ring to your account…");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (claimState !== "claimed") return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setClaimToken("");
      setNotice("30-Day Haven Plus activated! You can now try Seal with Ring.");
      window.location.assign("/app");
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
    setNotice("Connecting your ring to your account…");
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
          : "Ring successfully linked! Welcome to your sanctuary."
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

  useEffect(() => {
    if (sdmState.kind !== "ready" || sdmState.scene !== "new_ring_binding") {
      bindRingRedirectDoneRef.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const uid = (new URLSearchParams(window.location.search).get("uid") || "").trim();
    if (!uid) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    function go(session: Session | null) {
      if (!active || bindRingRedirectDoneRef.current) return;
      if (!session?.access_token) return;
      bindRingRedirectDoneRef.current = true;
      setNotice("Connecting your ring to your account…");
      window.location.assign(`/bind-ring?uid=${encodeURIComponent(uid)}`);
    }

    void supabase.auth.getSession().then(({ data }) => go(data.session ?? null));
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      go(session ?? null);
    });
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [sdmState]);

  /** Supabase OAuth errors are localized by Accept-Language; match EN + zh-CN for provider-disabled. */
  function isOAuthProviderNotEnabledMessage(message: string): boolean {
    const raw = String(message || "");
    const lower = raw.toLowerCase();
    if (lower.includes("provider is not enabled")) return true;
    if (lower.includes("unsupported provider")) return true;
    if (raw.includes("提供程序未启用")) return true;
    if (raw.includes("不支持的提供程序")) return true;
    return false;
  }

  function getFriendlyAuthError(message: string, provider: "apple" | "google") {
    if (isOAuthProviderNotEnabledMessage(message)) {
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
      const safeOrigin = canonicalAuthOriginFromLocation();
      const redirectTo = buildOAuthReturnUrl(safeOrigin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error) {
        if (
          provider === "apple" &&
          isOAuthProviderNotEnabledMessage(String(error.message || ""))
        ) {
          setAppleProviderReady(false);
          setNotice("Apple Sign In is not ready yet. Redirecting to Google Sign In...");
          window.setTimeout(() => {
            void signInWith("google");
          }, 250);
          return;
        }
        setNotice(getFriendlyAuthError(error.message, provider));
        try {
          window.localStorage.removeItem(FTUX_STARTED_KEY);
        } catch {
          /* ignore */
        }
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
          <header
            style={{
              ...styles.topBar,
              opacity: sealTopBarMuted ? 0.48 : 1,
            }}
          >
            <Link href="/app" style={styles.topBarLink} aria-label={START_PAGE_EN.backToHaven}>
              ← {START_PAGE_EN.backToHaven}
            </Link>
          </header>

          <StartRingGlyphPulse />

          {!nfcFlow ? (
            <>
              <p style={styles.kicker}>Haven Ring</p>
              <h1 style={styles.title}>{idleHero.title}</h1>
              <p style={{ ...styles.subtitle, whiteSpace: "pre-line" }}>{idleHero.subtitle}</p>
            </>
          ) : sdmCopy ? (
            <>
              <h1 style={{ ...styles.title, fontSize: 30, marginTop: 4 }}>{sdmCopy.title}</h1>
              <p style={{ ...styles.subtitle, fontSize: 16, lineHeight: 1.45 }}>
                {sdmCopy.placementHint || START_PAGE_EN.heroSubtitleFallback}
              </p>
            </>
          ) : null}

          {showSealCountdown && sealRemainingMs > 0 ? (
            <p style={styles.sealCountdownLine} role="timer" aria-live="polite">
              {START_PAGE_EN.sealCountdownPrefix}{" "}
              <strong>{formatSealCountdown(sealRemainingMs)}</strong>
            </p>
          ) : null}

          {nfcFlow && sdmCopy ? (
            <section
              style={{ ...styles.sdmCard, ...getSdmCardStyle(sdmState) }}
              role={sdmState.kind === "failed" ? "alert" : "status"}
              aria-live="polite"
            >
              {isDailySelfOwner ? (
                <p style={styles.sdmSuccessMark} aria-hidden>
                  ✓
                </p>
              ) : null}
              <p style={styles.sdmEyebrow}>{sdmCopy.eyebrow}</p>
              <p style={styles.sdmBody}>{sdmCopy.body}</p>
              {nfcFlow &&
              sdmCopy &&
              (sdmState.kind === "resolving" ||
                sdmState.kind === "failed" ||
                (sdmState.kind === "ready" &&
                  (sdmState.scene === "seal_confirmation" ||
                    sdmState.scene === "new_ring_binding" ||
                    isDailySelfOwner))) ? (
                <NfcPhoneHint platform={platform} />
              ) : null}
              {sdmCopy.placementHint && nfcFlow ? (
                <p style={styles.sdmHint}>{sdmCopy.placementHint}</p>
              ) : null}
              <div style={styles.sdmNextStep}>
                <span style={styles.sdmNextLabel}>Next</span>
                <span>{sdmCopy.nextLine}</span>
              </div>
              {sdmState.kind === "failed" ? (
                <div style={styles.sdmActions}>
                  <button type="button" onClick={retrySdmTouch} style={styles.sdmPrimaryAction}>
                    {START_PAGE_EN.retryRingTap}
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
                  ? "Ring successfully linked! Welcome to your sanctuary."
                  : claimState === "waiting_signin"
                    ? "Connecting your ring to your account. Please sign in, then we will finish linking automatically."
                    : "Connecting your ring to your account…"}
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
                    window.location.assign("/app");
                  }}
                  style={styles.secondaryButton}
                >
                  Continue without ring for now
                </button>
              ) : null}
            </section>
          ) : null}

          {nfcFlow && !claimToken ? (
            <footer style={styles.sealFooter}>
              <p style={styles.sealFooterSecurity}>{START_PAGE_EN.footerSecurityReminder}</p>
              {needsSealLeaveDouble && sealLeaveAck ? (
                <>
                  <p style={styles.sdmLeaveWarn}>{START_PAGE_EN.leaveSealWarning}</p>
                  <div style={styles.sealFooterActions}>
                    <button type="button" onClick={() => setSealLeaveAck(false)} style={styles.sdmPrimaryAction}>
                      {START_PAGE_EN.keepSealing}
                    </button>
                    <button type="button" onClick={confirmLeaveWithoutRing} style={styles.sealFooterDanger}>
                      {START_PAGE_EN.leaveSealConfirmCta}
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onFooterContinueWithoutRing}
                  style={{
                    ...styles.sdmSecondaryAction,
                    ...styles.sealFooterSingleCta,
                    ...(needsSealLeaveDouble && !sealLeaveAck ? styles.sdmSecondaryActionQuiet : {}),
                  }}
                >
                  {START_PAGE_EN.continueWithoutRing}
                </button>
              )}
            </footer>
          ) : null}

          {!hideFtuxOAuthDuringSealTouch ? (
            <>
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
            </>
          ) : null}

          {!nfcFlow && platform === "ios" ? (
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
  ringMarkWrap: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 88,
    margin: "2px 0 8px",
  },
  ringHalo: {
    position: "absolute",
    width: 92,
    height: 92,
    borderRadius: 999,
    border: "2px solid rgba(240,194,158,0.28)",
    animation: "havenStartRingHalo 2.4s ease-out infinite",
    pointerEvents: "none",
  },
  ringSvg: {
    position: "relative",
    animation: "havenStartRingGlow 2.2s ease-in-out infinite",
  },
  topBar: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 4,
    minHeight: 28,
  },
  topBarLink: {
    color: "#e7d2c3",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    letterSpacing: "0.02em",
  },
  sealCountdownLine: {
    margin: "4px 0 0",
    textAlign: "center",
    fontSize: 14,
    color: "#f0c29e",
    letterSpacing: "0.04em",
  },
  sealFooter: {
    marginTop: 8,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.12)",
    display: "grid",
    gap: 10,
  },
  sealFooterSecurity: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#cbb09f",
  },
  sealFooterActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  sealFooterSingleCta: {
    justifySelf: "start",
    maxWidth: "100%",
  },
  sealFooterDanger: {
    border: "1px solid rgba(255,157,137,0.55)",
    background: "rgba(72, 29, 25, 0.45)",
    color: "#ffded8",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  sdmSuccessMark: {
    margin: 0,
    fontSize: 36,
    lineHeight: 1,
    color: "#9fd7bd",
    textAlign: "center",
  },
  nfcDiagramWrap: {
    display: "flex",
    justifyContent: "center",
    margin: "4px 0 2px",
  },
  nfcSvg: {
    maxWidth: "100%",
    height: "auto",
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
  sdmHint: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "#cbb09f",
  },
  sdmLeaveWarn: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.45,
    color: "#ffcab5",
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
  sdmSecondaryActionQuiet: {
    opacity: 0.72,
    fontWeight: 600,
    fontSize: 14,
  },
};
