"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildBindRingUrl } from "@/lib/partner-invite-pending";
import {
  NFC_FLOW_TIMING,
  clearRingWaitReason,
  sleepMs,
  visibleSecondsRemaining,
  withTimeout,
} from "@/lib/nfc-flow-timing";
import { hasSdmSearch } from "@/lib/nfc-intent";
import { runNfcEntryOrchestrator } from "@/lib/nfc-entry-orchestrator";
import {
  listenForRingTapWithRetry,
  postSdmResolveWithRetry,
} from "@/lib/nfc-sdm-resolve-client";
import { USER_FACING, userFacingMessageFromUnknown } from "@/lib/user-facing-errors";
import { readPendingPartnerInviteCode } from "@/lib/partner-invite-pending";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isPermanentSupabaseSession } from "@/lib/appAuthGate";
import { usePlatform } from "@/src/hooks/usePlatform";
import { NfcHoldGuide } from "@/src/components/NfcHoldGuide";
import { NfcSyncedCountdown } from "@/src/components/NfcSyncedCountdown";
import { IndeterminateStepStatus } from "@/src/components/IndeterminateStepStatus";
import {
  START_PAGE_EN,
  getNfcHoldGuideCopy,
  getSealFlowCopy,
  type HavenPlatform,
  type StartSdmScene,
  type StartSdmStateForCopy,
} from "@/src/content/havenCopy";
import { deferEntryWork, isLowMemoryEntryDevice } from "@/lib/entry-defer";
import {
  getArmedSealDraftIds,
  getSealArmedRemainingMs,
  isSealFlowArmed,
} from "@/lib/seal-flow";
import { SEAL_SUCCESS_PATH } from "@/src/features/seal/sealTypes";
import {
  hasLocalSealPrep,
  isPrimarySealWaitPage,
  isRingTapSealLandingPage,
  isSealWaitSearch,
  sealRelayNavigateHref,
  shouldDeferSdmResolveToOwnerTab,
} from "@/src/features/seal/sealNavigate";
import {
  clearSealNfcTapHref,
  consumeFreshSealNfcTapHref,
  readFreshSealNfcTapHref,
  recordSealNfcTapHref,
  SEAL_NFC_TAP_STORAGE_KEY,
} from "@/src/features/seal/sealNfcTapRelay";
import {
  clearSealWaitTabActive,
  markSealWaitTabActive,
  releaseSealResolveLock,
  SEAL_COMPLETE_STORAGE_KEY,
  tryAcquireSealResolveLockForSealTap,
  wasSealRecentlyCompleted,
} from "@/src/features/seal/sealCrossTab";
import { startPageStyles as styles } from "./startPageStyles";
import { StartPageSkeleton } from "./StartPageSkeleton";

function isSealNfcLaunchSearch(search: string): boolean {
  return hasSdmSearch(search);
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

function StartRingGlyphPulse() {
  return (
    <div style={styles.ringMarkWrap} aria-hidden>
      <span style={styles.ringHalo} />
      <svg width="118" height="118" viewBox="0 0 76 76" style={styles.ringSvg}>
        <circle cx="38" cy="38" r="24" fill="none" stroke="#e6b48d" strokeWidth="5.5" />
        <circle cx="38" cy="38" r="14" fill="none" stroke="#f0c29e" strokeWidth="2.5" opacity="0.55" />
      </svg>
    </div>
  );
}

export default function StartClient() {
  const [notice, setNotice] = useState("");
  const [sdmState, setSdmState] = useState<StartSdmStateForCopy>(() => readInitialSdmState());
  const { platform: detectedPlatform, ready: platformReady } = usePlatform();
  const platform = (platformReady ? detectedPlatform : "other") as HavenPlatform;
  const sealFlow = useMemo(() => getSealFlowCopy(platform), [platform]);
  const nfcHoldCopy = useMemo(() => getNfcHoldGuideCopy(platform), [platform]);

  const [sealLeaveGuard, setSealLeaveGuard] = useState(false);
  const [sealLeaveAck, setSealLeaveAck] = useState(false);
  const pendingSealTapRef = useRef(false);
  const bindRingRedirectDoneRef = useRef(false);
  const nfcSdmResolveGenerationRef = useRef(0);
  const sealWaitStartedAtRef = useRef(0);
  const [sealPrepRevision, setSealPrepRevision] = useState(0);
  const [nfcSealBootstrapping, setNfcSealBootstrapping] = useState(() =>
    typeof window !== "undefined" ? isSealNfcLaunchSearch(window.location.search) : false
  );
  const [sealWaitMode, setSealWaitMode] = useState(false);
  const [sealRemoteFinishing, setSealRemoteFinishing] = useState(false);
  const [nfcSealScanBusy, setNfcSealScanBusy] = useState(false);
  const [ringTapError, setRingTapError] = useState("");
  const resolveStartedAtRef = useRef(0);
  const nfcResolveInFlightRef = useRef(false);
  const entryOrchestratorDoneRef = useRef(false);
  const [nfcUiTick, setNfcUiTick] = useState(0);
  const webNfcAvailable =
    typeof window !== "undefined" && "NDEFReader" in window;

  const nfcFlow = sdmState.kind !== "idle";
  const useMinimalShell = nfcFlow || sealWaitMode;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search;
    queueMicrotask(() => {
      setSealWaitMode(isPrimarySealWaitPage(search));
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const claim = normalizeClaimValue(params.get("claim") || "");
    if (!claim) return;
    window.location.replace(`/hub?token=${encodeURIComponent(claim)}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (entryOrchestratorDoneRef.current) return;
    entryOrchestratorDoneRef.current = true;

    let active = true;
    deferEntryWork(() => {
      void (async () => {
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const search = window.location.search || "";
        const params = new URLSearchParams(search);
        const plan = await runNfcEntryOrchestrator({
          surface: "start",
          search,
          uid: params.get("uid") || "",
          inviteCode: params.get("invite") || readPendingPartnerInviteCode(),
          accessToken: data.session?.access_token || "",
        });
        if (!active) return;

        if (plan.shouldEnablePairSharing) {
          const { setPairSharingEnabled } = await import(
            "@/src/services/pairSharingService"
          );
          setPairSharingEnabled(true);
        }

        if (
          plan.bindRingHref &&
          isPermanentSupabaseSession(data.session ?? null) &&
          plan.pendingInvite &&
          plan.hasOwnedCloudRing
        ) {
          const uid = params.get("uid") || "";
          if (uid || plan.bindRingHref.includes("uid=")) {
            window.location.assign(plan.bindRingHref);
          }
        }
      })();
    }, { timeout: isLowMemoryEntryDevice() ? 1600 : 600 });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    if (isSealNfcLaunchSearch(search)) return;
    if (isSealWaitSearch(search)) return;
    const claim = normalizeClaimValue(
      new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("claim") || ""
    );
    if (claim) return;
    deferEntryWork(
      () => {
        window.location.replace("/app");
      },
      { timeout: isLowMemoryEntryDevice() ? 900 : 300 }
    );
  }, []);

  const needsSealLeaveDouble =
    sealLeaveGuard &&
    (sdmState.kind === "resolving" ||
      sdmState.kind === "failed" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  const showSealCountdown =
    sealLeaveGuard &&
    isSealFlowArmed() &&
    (sdmState.kind === "resolving" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  const sealArmed = isSealFlowArmed();
  void sealPrepRevision;

  const showSealConnecting =
    nfcFlow &&
    (sealArmed || nfcSealBootstrapping) &&
    (sdmState.kind === "resolving" || nfcSealBootstrapping);

  const [sealClockTick, setSealClockTick] = useState(0);
  useEffect(() => {
    if (!showSealCountdown && !sealWaitMode) return;
    const id = window.setInterval(() => setSealClockTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [showSealCountdown, sealWaitMode]);

  const sealRemainingMs = useMemo(() => {
    void sealClockTick;
    return getSealArmedRemainingMs();
  }, [sealClockTick, showSealCountdown, sealWaitMode]);

  const showResolveCountdown =
    sdmState.kind === "resolving" ||
    nfcSealBootstrapping ||
    (sealWaitMode && sealRemainingMs > 0);

  useEffect(() => {
    if (!showResolveCountdown) return;
    const id = window.setInterval(() => setNfcUiTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [showResolveCountdown]);

  function renderResolveCountdown() {
    void nfcUiTick;
    const now = Date.now();

    if (sealWaitMode && sealRemainingMs > 0) {
      return (
        <p style={styles.minimalCountdown} role="timer" aria-live="polite">
          {START_PAGE_EN.sealCountdownPrefix}{" "}
          <strong>{formatSealCountdown(sealRemainingMs)}</strong>
        </p>
      );
    }

    if (
      (sdmState.kind === "resolving" || nfcSealBootstrapping) &&
      resolveStartedAtRef.current > 0
    ) {
      const endsAt = resolveStartedAtRef.current + NFC_FLOW_TIMING.minResolvingMs;
      const readingRemaining = visibleSecondsRemaining(endsAt, now);
      if (readingRemaining > 0) {
        return (
          <NfcSyncedCountdown label={nfcHoldCopy.readingCountdownPrefix} endsAt={endsAt} />
        );
      }
      return <p style={styles.minimalHint}>{nfcHoldCopy.stillReadingLine}</p>;
    }

    return null;
  }

  function retrySdmTouch() {
    if (typeof window === "undefined") return;
    if (isSealFlowArmed() || isPrimarySealWaitPage(window.location.search)) {
      const wait = new URL("/start", window.location.origin);
      wait.searchParams.set("seal_wait", "1");
      wait.searchParams.set("intent", "seal");
      window.location.replace(wait.href);
      return;
    }
    setNotice(nfcHoldCopy.replaySubtitle);
  }

  async function handleSealWaitRingScan() {
    if (!webNfcAvailable || nfcSealScanBusy) return;
    setRingTapError("");
    setNfcSealScanBusy(true);
    try {
      const result = await listenForRingTapWithRetry(window.location.origin);
      if (!result.ok) {
        setRingTapError(result.message);
        return;
      }
      window.location.replace(sealRelayNavigateHref(result.target));
    } catch (error) {
      setRingTapError(userFacingMessageFromUnknown(error, USER_FACING.tapRingAgain));
    } finally {
      setNfcSealScanBusy(false);
    }
  }

  async function confirmLeaveWithoutRing() {
    if (typeof window === "undefined") return;
    setSealLeaveAck(false);
    clearSealWaitTabActive();
    const armedIds = getArmedSealDraftIds();
    const { readPendingSealDraftIds, clearSealPrepState } = await import(
      "@/src/features/seal/sealFlowClient"
    );
    const draftId = armedIds[0] || readPendingSealDraftIds()[0] || "";
    clearSealPrepState();
    if (draftId) {
      window.location.assign(
        `/app?open=new&fromDraft=${encodeURIComponent(draftId)}`
      );
      return;
    }
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

  function cancelNfcFlow() {
    if (typeof window === "undefined") return;
    if (needsSealLeaveDouble) {
      confirmLeaveWithoutRing();
      return;
    }
    window.location.assign("/app");
  }

  function openApp() {
    if (typeof window === "undefined") return;
    window.location.assign("/app");
  }

  function goToLoginForBind() {
    if (typeof window === "undefined") return;
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/login?next=${encodeURIComponent(next)}`);
  }

  function bindCurrentRing() {
    if (typeof window === "undefined") return;
    const uid = readUidForBind(sdmState);
    if (!uid) {
      setNotice(START_PAGE_EN.ringVerifyFailedNotice);
      return;
    }
    window.location.assign(buildBindRingUrl(window.location.origin, uid));
  }

  function readUidForBind(state: StartSdmStateForCopy): string {
    if (typeof window === "undefined") return "";
    const fromUrl = (new URLSearchParams(window.location.search).get("uid") || "").trim();
    if (fromUrl) return fromUrl;
    if (state.kind === "ready" && state.resolvedUid) {
      return String(state.resolvedUid).trim();
    }
    return "";
  }

  type MinimalNfcView = {
    title: string;
    subtitle: string;
    showGuide: boolean;
    stepLine?: string;
    button?: string;
    onAction?: (() => void) | null;
    showSealScan?: boolean;
    showOpenApp?: boolean;
  };

  function minimalNfcCopy(): MinimalNfcView {
    if (sealWaitMode && sdmState.kind === "idle" && !sealRemoteFinishing) {
      return {
        title: nfcHoldCopy.sealWaitTitle,
        subtitle: nfcHoldCopy.sealWaitSubtitle,
        showGuide: true,
        stepLine: nfcHoldCopy.waitStep,
        showSealScan: webNfcAvailable,
      };
    }
    if (sealWaitMode && sealRemoteFinishing) {
      return {
        title: START_PAGE_EN.sealWaitFinishingTitle,
        subtitle: nfcHoldCopy.holdSteadyLine,
        showGuide: true,
      };
    }
    if (sdmState.kind === "failed") {
      return {
        title: nfcHoldCopy.failedTitle,
        subtitle: sdmState.message || USER_FACING.tapRingAgain,
        showGuide: true,
        stepLine: nfcHoldCopy.waitStep,
        button: nfcHoldCopy.tapRingAgainCta,
        onAction: retrySdmTouch,
      };
    }
    if (sdmState.kind === "resolving" || showSealConnecting || nfcSealBootstrapping) {
      return {
        title: nfcHoldCopy.resolvingTitle,
        subtitle: nfcHoldCopy.resolvingSubtitle,
        showGuide: true,
        stepLine: nfcHoldCopy.holdSteadyLine,
      };
    }
    if (sdmState.kind === "ready" && sdmState.scene === "new_ring_binding") {
      return {
        title: "Bind this ring?",
        subtitle: "",
        showGuide: false,
        button: "Continue",
        onAction: bindCurrentRing,
      };
    }
    if (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation") {
      return {
        title: START_PAGE_EN.preparingMemory,
        subtitle: nfcHoldCopy.holdSteadyLine,
        showGuide: true,
      };
    }
    if (sdmState.kind === "ready" && sdmState.scene === "daily_access") {
      return {
        title: START_PAGE_EN.idleRingAck,
        subtitle: "",
        showGuide: false,
        showOpenApp: true,
      };
    }
    return {
      title: nfcHoldCopy.waitTitle,
      subtitle: nfcHoldCopy.waitSubtitle,
      showGuide: true,
      stepLine: nfcHoldCopy.waitStep,
    };
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
    if (!isSealNfcLaunchSearch(window.location.search)) return;
    recordSealNfcTapHref(window.location.href);
  }, []);

  useEffect(() => {
    if (!sealWaitMode || typeof window === "undefined") return undefined;
    const startedAt = Date.now();
    sealWaitStartedAtRef.current = startedAt;
    clearSealNfcTapHref();
    markSealWaitTabActive();
    queueMicrotask(() => setSealLeaveGuard(true));
    pendingSealTapRef.current = true;

    const goSuccess = () => {
      clearSealWaitTabActive();
      window.location.assign(SEAL_SUCCESS_PATH);
      return true;
    };

    const followSealTap = () => {
      if (wasSealRecentlyCompleted()) {
        return goSuccess();
      }
      if (document.visibilityState === "hidden") {
        const relay = readFreshSealNfcTapHref();
        if (relay) {
          setSealRemoteFinishing(true);
          setNotice(START_PAGE_EN.sealWaitFinishingTitle);
        }
        return false;
      }
      if (isSealNfcLaunchSearch(window.location.search)) {
        const u = new URL(window.location.href);
        u.searchParams.delete("seal_wait");
        if (!u.searchParams.get("intent")) {
          u.searchParams.set("intent", "seal");
        }
        window.location.replace(`${u.pathname}${u.search}${u.hash}`);
        return true;
      }
      const relay = consumeFreshSealNfcTapHref({ sinceTs: startedAt });
      if (relay) {
        setSealRemoteFinishing(true);
        setNotice(START_PAGE_EN.sealWaitFinishingTitle);
        window.location.replace(sealRelayNavigateHref(relay));
        return true;
      }
      return false;
    };

    const poll = window.setInterval(followSealTap, 400);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SEAL_NFC_TAP_STORAGE_KEY) followSealTap();
      if (event.key === SEAL_COMPLETE_STORAGE_KEY && wasSealRecentlyCompleted()) {
        goSuccess();
      }
    };
    let unsubBroadcast: (() => void) | null = null;
    void import("@/src/features/seal/sealBroadcast").then((mod) => {
      unsubBroadcast = mod.subscribeSealBroadcast((message) => {
        if (message.type === "nfc_tap") followSealTap();
        if (message.type === "seal_complete" && wasSealRecentlyCompleted()) {
          goSuccess();
        }
      });
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") followSealTap();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    followSealTap();

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      unsubBroadcast?.();
    };
  }, [sealWaitMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = window.location.search || "";
    const params = new URLSearchParams(search);
    const uid = params.get("uid") || "";
    const ctr = params.get("ctr") || "";
    const cmac = params.get("cmac") || "";
    const picc = params.get("picc") || params.get("picc_data") || "";
    if (!cmac || (!picc && (!uid || !ctr))) return;
    if (hasLocalSealPrep()) {
      try {
        const u = new URL(window.location.href);
        if (!u.searchParams.get("intent")) {
          u.searchParams.set("intent", "seal");
          window.history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
        }
      } catch {
        /* ignore */
      }
    }
    pendingSealTapRef.current = hasLocalSealPrep();
    if (pendingSealTapRef.current) {
      setSealLeaveGuard(true);
    }
    resolveStartedAtRef.current = Date.now();
    recordSealNfcTapHref(window.location.href);
    const myGen = ++nfcSdmResolveGenerationRef.current;

    const initialStateTimer = window.setTimeout(() => {
      setNotice(START_PAGE_EN.readingRingStatus);
    }, 0);

    const controller = new AbortController();
    const supabase = getSupabaseBrowserClient();
    let sealLockId: string | null = null;
    let completePollId: number | null = null;

    if (shouldDeferSdmResolveToOwnerTab(search)) {
      setSdmState({ kind: "resolving" });
      setNotice(START_PAGE_EN.sealWaitFinishingTitle);
      completePollId = window.setInterval(() => {
        if (wasSealRecentlyCompleted()) {
          clearSealWaitTabActive();
          window.location.assign(SEAL_SUCCESS_PATH);
        }
      }, 400);
      return () => {
        window.clearTimeout(initialStateTimer);
        if (completePollId) window.clearInterval(completePollId);
      };
    }

    void (async () => {
      resolveStartedAtRef.current = Date.now();
      nfcResolveInFlightRef.current = true;
      setNfcSealBootstrapping(true);
      setSdmState({ kind: "resolving" });
      const watchdogId = window.setTimeout(() => {
        if (!nfcResolveInFlightRef.current || myGen !== nfcSdmResolveGenerationRef.current) {
          return;
        }
        nfcResolveInFlightRef.current = false;
        controller.abort();
        setNfcSealBootstrapping(false);
        setSdmState({
          kind: "failed",
          message: USER_FACING.tapRingAgain,
        });
        setNotice(USER_FACING.tapRingAgain);
      }, NFC_FLOW_TIMING.sdmResolveWatchdogMs);
      try {
        const sealFlow = await import("@/src/features/seal/sealFlowClient");
        sealFlow.syncHydrateSealPrepFromStorage();
        setSealPrepRevision((n) => n + 1);

        const {
          context,
          draft_ids: pendingSealDraftIds,
          staging_id: pendingSealStagingId,
        } = sealFlow.getSealSdmContextPayload();
        pendingSealTapRef.current =
          Boolean(String(context || "").trim()) || pendingSealDraftIds.length > 0;
        setSealLeaveGuard(pendingSealTapRef.current);

        const isSealAttempt =
          pendingSealTapRef.current || isRingTapSealLandingPage(search);
        if (isSealAttempt) {
          const lockDeadline = Date.now() + NFC_FLOW_TIMING.sealLockRetryMs;
          while (!sealLockId && Date.now() < lockDeadline) {
            if (wasSealRecentlyCompleted()) {
              clearSealWaitTabActive();
              window.location.assign(SEAL_SUCCESS_PATH);
              return;
            }
            sealLockId = tryAcquireSealResolveLockForSealTap({
              foreground: document.visibilityState === "visible",
            });
            if (sealLockId) break;
            await sleepMs(400);
          }
          if (!sealLockId) {
            throw new Error(USER_FACING.tapRingAgain);
          }
        }

        try {
          await withTimeout(
            supabase.auth.initialize(),
            NFC_FLOW_TIMING.sdmResolveAuthTimeoutMs,
            "Sign-in check timed out."
          );
        } catch {
          /* offline or timeout */
        }
        const { data: sessionData } = await withTimeout(
          supabase.auth.getSession(),
          NFC_FLOW_TIMING.sdmResolveAuthTimeoutMs,
          "Sign-in check timed out."
        );
        if (myGen !== nfcSdmResolveGenerationRef.current) return;

        const accessToken = sessionData.session?.access_token || "";
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        if (
          !accessToken &&
          pendingSealTapRef.current &&
          !isPermanentSupabaseSession(sessionData.session ?? null)
        ) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }

        const fetchTimeoutId = window.setTimeout(
          () => controller.abort(),
          NFC_FLOW_TIMING.sdmResolveFetchTimeoutMs
        );
        let resolveResult: Awaited<ReturnType<typeof postSdmResolveWithRetry>>;
        try {
          resolveResult = await postSdmResolveWithRetry({
            headers,
            body: {
              uid,
              ctr,
              cmac,
              picc,
              context,
              draft_ids: pendingSealDraftIds,
              ...(pendingSealStagingId ? { staging_id: pendingSealStagingId } : {}),
            },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(fetchTimeoutId);
        }
        if (myGen !== nfcSdmResolveGenerationRef.current) return;

        if (!resolveResult.ok) {
          await sleepMs(
            Math.max(0, NFC_FLOW_TIMING.minResolvingMs - (Date.now() - resolveStartedAtRef.current))
          );
          if (myGen !== nfcSdmResolveGenerationRef.current) return;
          if (resolveResult.apiCode === "SDM_REPLAY_DETECTED") {
            setSdmState({
              kind: "failed",
              message: USER_FACING.tapRingAgain,
            });
            setNotice(USER_FACING.tapRingAgain);
            return;
          }
          throw new Error(resolveResult.message);
        }

        const data = resolveResult.data;
        const scene: StartSdmScene = isSdmScene(data.scene) ? data.scene : "daily_access";
        if (scene === "daily_access" && pendingSealTapRef.current) {
          throw new Error(USER_FACING.tapRingAgain);
        }
        const viewerUserId = sessionData.session?.user?.id ?? null;
        await sleepMs(
          Math.max(0, NFC_FLOW_TIMING.minResolvingMs - (Date.now() - resolveStartedAtRef.current))
        );
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
        clearRingWaitReason();
        const resolvedUid = typeof data.uid === "string" ? data.uid.trim() : "";
        if (resolvedUid && scene === "new_ring_binding") {
          try {
            const u = new URL(window.location.href);
            u.searchParams.set("uid", resolvedUid);
            window.history.replaceState({}, "", `${u.pathname}${u.search}`);
          } catch {
            /* ignore */
          }
        }
        setSdmState({
          kind: "ready",
          scene,
          ringId: typeof data.ringId === "string" ? data.ringId : null,
          ownerId: typeof data.ownerId === "string" ? data.ownerId : null,
          viewerUserId,
          currentUserIsHavenMember: Boolean(data.currentUserIsHavenMember),
          resolvedUid: resolvedUid || null,
        });
        setNotice(
          scene === "new_ring_binding"
            ? "Bind this ring?"
            : scene === "seal_confirmation"
              ? START_PAGE_EN.preparingMemory
              : START_PAGE_EN.idleRingAck
        );
        if (scene === "seal_confirmation") {
          if (!accessToken) {
            throw new Error(nfcHoldCopy.signInSubtitle);
          }
          if (!data.sealTicket) {
            throw new Error("We could not finish that tap.");
          }
          if (myGen !== nfcSdmResolveGenerationRef.current) return;
          setNotice(START_PAGE_EN.preparingMemory);
          const { finalizeSealChainFromSdmResponseSafe } = await import(
            "@/src/features/seal/sealFinalizeSafe"
          );
          const finalizeResult = await withTimeout(
            finalizeSealChainFromSdmResponseSafe({
              sealTicket: String(data.sealTicket),
              draftIds: pendingSealDraftIds,
              accessToken,
            }),
            NFC_FLOW_TIMING.sdmResolveFetchTimeoutMs,
            USER_FACING.sealSavedLocal
          );
          if (!finalizeResult.ok) {
            throw new Error(finalizeResult.message);
          }
        }
      } catch (error) {
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
        await sleepMs(
          Math.max(0, NFC_FLOW_TIMING.minResolvingMs - (Date.now() - resolveStartedAtRef.current))
        );
        if (myGen !== nfcSdmResolveGenerationRef.current) return;
        const baseMsg = userFacingMessageFromUnknown(error, USER_FACING.tapRingAgain);
        setSdmState({
          kind: "failed",
          message: baseMsg,
        });
        setNotice(USER_FACING.tapRingAgain);
      } finally {
        window.clearTimeout(watchdogId);
        if (myGen === nfcSdmResolveGenerationRef.current) {
          nfcResolveInFlightRef.current = false;
          setNfcSealBootstrapping(false);
        }
        if (sealLockId) releaseSealResolveLock(sealLockId);
      }
    })();

    return () => {
      window.clearTimeout(initialStateTimer);
      if (completePollId) window.clearInterval(completePollId);
      controller.abort();
      setNfcSealBootstrapping(false);
    };
  }, []);

  useEffect(() => {
    if (sdmState.kind !== "ready" || sdmState.scene !== "new_ring_binding") {
      bindRingRedirectDoneRef.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const uid = readUidForBind(sdmState);
    if (!uid) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    function go(session: Session | null) {
      if (!active || bindRingRedirectDoneRef.current) return;
      if (!session?.access_token) return;
      bindRingRedirectDoneRef.current = true;
      window.location.assign(buildBindRingUrl(window.location.origin, uid));
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

  const [hasSessionForBind, setHasSessionForBind] = useState(false);
  useEffect(() => {
    if (sdmState.kind !== "ready" || sdmState.scene !== "new_ring_binding") {
      setHasSessionForBind(false);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSessionForBind(Boolean(data.session?.access_token));
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSessionForBind(Boolean(session?.access_token));
    });
    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [sdmState]);

  if (!useMinimalShell) {
    return <StartPageSkeleton />;
  }

  const copy = minimalNfcCopy();
  const showSealFooter =
    nfcFlow &&
    (needsSealLeaveDouble ||
      sdmState.kind === "resolving" ||
      sdmState.kind === "failed" ||
      (sdmState.kind === "ready" && sdmState.scene === "seal_confirmation"));

  return (
    <main style={styles.minimalPage}>
      <button type="button" onClick={cancelNfcFlow} style={styles.minimalCancel}>
        {START_PAGE_EN.backToHaven}
      </button>
      <section style={styles.minimalPanel} aria-live="polite">
        <StartRingGlyphPulse />
        <h1 style={styles.minimalTitle}>{copy.title}</h1>
        {copy.subtitle ? <p style={styles.minimalSubtitle}>{copy.subtitle}</p> : null}
        {renderResolveCountdown()}
        {copy.showGuide ? (
          <NfcHoldGuide platform={platform} stepLine={copy.stepLine} />
        ) : null}
        {copy.showSealScan ? (
          <button
            type="button"
            onClick={() => void handleSealWaitRingScan()}
            disabled={nfcSealScanBusy}
            style={styles.minimalSecondary}
          >
            {nfcSealScanBusy ? sealFlow.sealScanRingBusy : sealFlow.sealScanRingCta}
          </button>
        ) : null}
        {ringTapError ? (
          <p style={styles.minimalError} role="alert">
            {ringTapError}
          </p>
        ) : null}
        {nfcSealScanBusy ? (
          <IndeterminateStepStatus
            active
            label={nfcHoldCopy.listeningStatusLine}
            slowLabel={nfcHoldCopy.stillListeningLine}
            style={styles.minimalHint}
          />
        ) : null}
        {copy.showOpenApp ? (
          <button type="button" onClick={openApp} style={styles.minimalPrimary}>
            {START_PAGE_EN.openAppCta}
          </button>
        ) : null}
        {copy.button && copy.onAction ? (
          <button
            type="button"
            onClick={() => {
              if (
                sdmState.kind === "ready" &&
                sdmState.scene === "new_ring_binding" &&
                !hasSessionForBind
              ) {
                goToLoginForBind();
                return;
              }
              copy.onAction?.();
            }}
            style={styles.minimalPrimary}
          >
            {sdmState.kind === "ready" &&
            sdmState.scene === "new_ring_binding" &&
            !hasSessionForBind
              ? "Sign in"
              : copy.button}
          </button>
        ) : null}
        {notice ? <p style={styles.minimalHint}>{notice}</p> : null}
      </section>

      {showSealFooter ? (
        <footer style={styles.sealFooter}>
          {needsSealLeaveDouble && sealLeaveAck ? (
            <>
              <p style={styles.sdmLeaveWarn}>{START_PAGE_EN.leaveSealWarning}</p>
              <div style={styles.sealFooterActions}>
                <button
                  type="button"
                  onClick={() => setSealLeaveAck(false)}
                  style={styles.sdmPrimaryAction}
                >
                  {START_PAGE_EN.keepSealing}
                </button>
                <button
                  type="button"
                  onClick={confirmLeaveWithoutRing}
                  style={styles.sealFooterDanger}
                >
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
    </main>
  );
}
