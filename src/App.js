"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "./components/AppChrome";
import {
  RingSetupWizard,
  RING_SETUP_DISMISSED_KEY,
} from "./components/RingSetupWizard";
import { HomePage } from "./views/HomePage";
import { TimelinePage } from "./views/TimelinePage";
import { ExplorePage } from "./views/ExplorePage";
import { RingsPage } from "./views/RingsPage";
import { NewMemoryPage } from "./views/NewMemoryPage";
import { MemoryDetailPage } from "./views/MemoryDetailPage";
import { SettingsPage } from "./views/SettingsPage";
import { HelpCenterPage } from "./views/HelpCenterPage";
import { useMemories } from "./hooks/useMemories";
import { useSupabaseSession } from "./hooks/useSupabaseSession";
import { usePwaLocale } from "./i18n/pwaLocale";
import { getSupabaseBrowserClient } from "../lib/supabase/client";
import { getBoundRingCount } from "./services/ringRegistryService";
import { scheduleWelcomeToast } from "./utils/welcomeToast";
import {
  isTemporaryDeviceModeEnabled,
  TEMP_DEVICE_MODE_EVENT,
  wipeTemporaryDevice,
} from "./services/temporaryDeviceService";
import { AppFlowProvider, useAppFlow } from "./state/appFlowContext";
import { getFlowPrimaryUi, getRecoveryActionIntent } from "./state/appFlowSelectors";
import { FIRST_MEMORY_DONE_KEY } from "./services/firstRunTelemetryService";
import { getSecuritySummary } from "./services/deviceTrustService";

export default function App() {
  return (
    <AppFlowProvider>
      <AppOrchestrator />
    </AppFlowProvider>
  );
}

function AppOrchestrator() {
  const [route, setRoute] = useState({ name: "timeline", memoryId: null });
  const [transitionDirection, setTransitionDirection] = useState("forward");
  const [swipeDx, setSwipeDx] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const locale = usePwaLocale();
  const touchStartRef = useRef(null);
  const {
    memories,
    loading,
    saving,
    syncing,
    error,
    integrityWarning,
    cloudPlaceholders,
    syncIssues,
    syncMeta,
    syncHealth,
    refresh,
    syncNow,
    syncActiveRingNow,
    createMemory,
  } = useMemories();
  const { session: supabaseSession, loading: sessionLoading } =
    useSupabaseSession();
  const [hideNfcPrompt, setHideNfcPrompt] = useState(false);
  const [quickSigningIn, setQuickSigningIn] = useState(false);
  const [quickSignInError, setQuickSignInError] = useState("");
  const [ringSetupOpen, setRingSetupOpen] = useState(false);
  const [ringSetupKey, setRingSetupKey] = useState(0);
  const [temporaryModeBanner, setTemporaryModeBanner] = useState(() =>
    isTemporaryDeviceModeEnabled()
  );
  const { flowState, dispatchFlow } = useAppFlow();
  const loginSyncDoneForSessionRef = useRef("");
  const tempWipeStartedRef = useRef(false);

  const selectedMemory = useMemo(
    () => memories.find((m) => m.id === route.memoryId) || null,
    [memories, route.memoryId]
  );
  const flowPrimaryUi = useMemo(
    () => getFlowPrimaryUi(flowState, locale),
    [flowState, locale]
  );
  const enforceSingleFlowCard = Boolean(flowPrimaryUi?.enforceSingle);

  const flowPrimaryAction = useCallback((intent = "primary") => {
    if (!flowPrimaryUi) return;
    if (flowState.mainState === "RING_SETUP_GATE") {
      openRingSetup();
      return;
    }
    if (flowState.mainState === "SYNC_GATE") {
      void syncNow();
      return;
    }
    if (flowState.mainState === "PWA_INSTALL_GATE") {
      if (intent === "defer_pwa") {
        dispatchFlow({ type: "PWA_DEFERRED" });
        return;
      }
      openRingSetup();
      navigateTo({ name: "home", memoryId: null }, "back");
      return;
    }
    if (flowState.mainState === "RECOVERY") {
      const errorType = String(flowState.recoveryErrorType || "");
      const actionIntent = getRecoveryActionIntent(errorType);
      if (actionIntent === "reauth") {
        dispatchFlow({ type: "RECOVERY_DISMISSED" });
        navigateTo({ name: "home", memoryId: null }, "back");
        return;
      }
      if (actionIntent === "open_ring_setup") {
        openRingSetup();
        return;
      }
      if (actionIntent === "rebuild_and_sync") {
        void syncNow().finally(() => {
          dispatchFlow({ type: "RECOVERY_DISMISSED" });
        });
        return;
      }
      void syncNow().finally(() => {
        dispatchFlow({ type: "RECOVERY_DISMISSED" });
      });
    }
  }, [flowPrimaryUi, flowState.mainState, flowState.recoveryErrorType, openRingSetup, syncNow]);

  function openRingSetup() {
    setRingSetupKey((k) => k + 1);
    setRingSetupOpen(true);
  }

  function handleAfterOnboarding() {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(RING_SETUP_DISMISSED_KEY) === "1";
    if (!dismissed && getBoundRingCount() === 0) {
      openRingSetup();
    }
  }

  function handleRingSetupFinished(payload) {
    const nickname = payload?.nickname || "friend";
    scheduleWelcomeToast({ nickname });
    setRingSetupOpen(false);
    navigateTo({ name: "timeline", memoryId: null }, "forward");
    void refresh();
  }

  const activeTab = useMemo(() => {
    if (route.name === "explore") return "explore";
    if (route.name === "rings") return "rings";
    if (route.name === "new") return "seal";
    return "timeline";
  }, [route.name]);

  const showBottomNav = !["new", "detail", "help"].includes(route.name);
  const boundRingCount = getBoundRingCount();

  const shellProps = {
    locale,
    showBottomNav,
    activeTab,
    onTabTimeline: async () => {
      await refresh();
      navigateTo({ name: "timeline", memoryId: null }, "back");
    },
    onTabExplore: () => navigateTo({ name: "explore", memoryId: null }, "forward"),
    onTabSeal: () => navigateTo({ name: "new", memoryId: null }, "forward"),
    onTabRings: () => navigateTo({ name: "rings", memoryId: null }, "forward"),
    onNavigateSettings: () =>
      navigateTo({ name: "settings", memoryId: null }, "forward"),
    onNavigateHelp: () => navigateTo({ name: "help", memoryId: null }, "forward"),
    showTemporaryBanner: temporaryModeBanner,
    statusSignedIn: Boolean(supabaseSession),
    statusRingBound: boundRingCount > 0,
    statusSealRequiresRing: boundRingCount > 0,
  };

  function renderWithShell(content) {
    const dragStyle = {
      transform: swipeDx > 0 ? `translateX(${swipeDx}px)` : "translateX(0px)",
      transition: isSwiping ? "none" : "transform 220ms ease-out",
      willChange: "transform",
    };

    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={dragStyle}
      >
        <AppChrome {...shellProps}>{content}</AppChrome>
      </div>
    );
  }

  function navigateTo(nextRoute, direction = "forward") {
    setTransitionDirection(direction);
    setRoute(nextRoute);
  }

  const scheduleBackgroundSync = useCallback(() => {
    const run = () => {
      void syncNow().catch(() => null);
      void refresh().catch(() => null);
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }
    window.setTimeout(run, 400);
  }, [syncNow, refresh]);

  async function handleQuickSignIn(provider, token) {
    setQuickSigningIn(true);
    setQuickSignInError("");
    try {
      const ua = navigator.userAgent.toLowerCase();
      const isAppleDevice =
        /iphone|ipad|ipod/.test(ua) ||
        (ua.includes("macintosh") && "ontouchend" in window);
      if (provider === "apple" && !isAppleDevice) {
        setQuickSignInError(
          "Apple Sign In is unavailable on this device. Use Google instead."
        );
        return;
      }
      const supabase = getSupabaseBrowserClient();
      const redirectTo = token
        ? `${window.location.origin}/hub?token=${encodeURIComponent(token)}`
        : `${window.location.origin}/`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) {
        setQuickSignInError(
          "Sign-in could not start. Please try again or switch sign-in method."
        );
      }
    } finally {
      setQuickSigningIn(false);
    }
  }

  async function openMemoryFromRingParams(memoryId) {
    if (!memoryId) return;
    await refresh();
    navigateTo({ name: "detail", memoryId }, "forward");
  }

  useEffect(() => {
    const done = localStorage.getItem("haven.onboarding.completed.v1") === "1";
    if (done) return;
    queueMicrotask(() => {
      setRoute({ name: "home", memoryId: null });
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId =
      params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    void openMemoryFromRingParams(memoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    queueMicrotask(() => {
      setHideNfcPrompt(Boolean(supabaseSession));
    });
    if (!supabaseSession) {
      loginSyncDoneForSessionRef.current = "";
      return;
    }
    const sessionKey = String(supabaseSession.access_token || "");
    if (sessionKey && loginSyncDoneForSessionRef.current !== sessionKey) {
      loginSyncDoneForSessionRef.current = sessionKey;
      scheduleBackgroundSync();
    }
  }, [supabaseSession, sessionLoading, scheduleBackgroundSync]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const platform = /iphone|ipad|ipod/.test(ua)
      ? "ios"
      : ua.includes("android")
        ? "android"
        : "other";
    const webNfcAvailable = typeof window !== "undefined" && "NDEFReader" in window;
    const pwaInstalled = Boolean(
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator?.standalone === true
    );
    const security = getSecuritySummary();
    dispatchFlow({
      type: "BOOTSTRAP_DONE",
      hasSession: Boolean(supabaseSession),
      hasBoundRing: getBoundRingCount() > 0,
      platform,
      webNfcAvailable,
      pwaInstalled,
      trustedCurrentDevice: Boolean(security.trustedCurrentDevice),
      requireSecondaryOnRingEntry: true,
    });
  }, [supabaseSession]);

  useEffect(() => {
    dispatchFlow({
      type: "SESSION_CHANGED",
      hasSession: Boolean(supabaseSession),
    });
    dispatchFlow({
      type: "RINGS_CHANGED",
      hasBoundRing: getBoundRingCount() > 0,
    });
  }, [supabaseSession, ringSetupOpen, route.name]);

  useEffect(() => {
    dispatchFlow({ type: "SYNC_STATUS", syncing: Boolean(syncing) });
    if (syncHealth?.severity === "hard") {
      if (
        syncHealth.reason === "auth_expired" &&
        supabaseSession &&
        !sessionLoading
      ) {
        dispatchFlow({ type: "SYNC_RECOVERED" });
        return;
      }
      dispatchFlow({
        type: "SYNC_HARD_FAILED",
        errorType: syncHealth.reason || "auth_expired",
      });
      return;
    }
    dispatchFlow({ type: "SYNC_RECOVERED" });
  }, [syncing, syncHealth, supabaseSession, sessionLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ftuxWelcomeDone =
      window.localStorage.getItem("haven.onboarding.completed.v1") === "1";
    const ftuxFirstMemoryDone =
      window.localStorage.getItem(FIRST_MEMORY_DONE_KEY) === "1";
    dispatchFlow({
      type: "FTUX_SYNC",
      ftuxLandingSignedIn: Boolean(supabaseSession),
      ftuxPwaDone: Boolean(flowState.pwaInstalled || flowState.pwaDeferred),
      ftuxWelcomeDone,
      ftuxFirstMemoryDone,
    });
  }, [
    supabaseSession,
    flowState.pwaInstalled,
    flowState.pwaDeferred,
    route.name,
    dispatchFlow,
  ]);

  useEffect(() => {
    if (flowState.mainState !== "RING_SETUP_GATE") return;
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(RING_SETUP_DISMISSED_KEY) === "1";
    if (dismissed || ringSetupOpen) return;
    setRingSetupKey((k) => k + 1);
    setRingSetupOpen(true);
  }, [flowState.mainState, ringSetupOpen]);

  useEffect(() => {
    const onModeChanged = (evt) => {
      const enabled = Boolean(evt?.detail?.enabled);
      setTemporaryModeBanner(enabled);
    };
    const onStorage = (evt) => {
      if (evt.key === "haven.session.temporaryDevice.v1") {
        setTemporaryModeBanner(isTemporaryDeviceModeEnabled());
      }
    };
    window.addEventListener(TEMP_DEVICE_MODE_EVENT, onModeChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TEMP_DEVICE_MODE_EVENT, onModeChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isTemporaryDeviceModeEnabled()) return undefined;
    const runWipe = () => {
      if (tempWipeStartedRef.current) return;
      tempWipeStartedRef.current = true;
      void wipeTemporaryDevice().catch(() => {
        tempWipeStartedRef.current = false;
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        runWipe();
      }
    };
    window.addEventListener("pagehide", runWipe);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", runWipe);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [temporaryModeBanner]);

  function goBackByRoute() {
    if (route.name === "detail" || route.name === "new") {
      navigateTo({ name: "timeline", memoryId: null }, "back");
      return;
    }
    if (route.name === "help") {
      navigateTo({ name: "timeline", memoryId: null }, "back");
    }
  }

  function handleTouchStart(event) {
    if (!["detail", "new", "help"].includes(route.name)) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    if (touch.clientX > 32) {
      touchStartRef.current = null;
      return;
    }
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      ts: Date.now(),
    };
    setSwipeDx(0);
    setIsSwiping(true);
  }

  function handleTouchMove(event) {
    const start = touchStartRef.current;
    if (!start) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = Math.max(0, touch.clientX - start.x);
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaY > 64) {
      setSwipeDx(0);
      return;
    }
    setSwipeDx(Math.min(deltaX, 120));
  }

  function handleTouchEnd(event) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.ts;
    const isHorizontalSwipe = deltaX > 72 && Math.abs(deltaY) < 48;
    const isFastEnough = elapsed < 700;
    if (isHorizontalSwipe && isFastEnough) {
      setSwipeDx(0);
      setIsSwiping(false);
      goBackByRoute();
      return;
    }
    setSwipeDx(0);
    setIsSwiping(false);
  }

  function handleTouchCancel() {
    touchStartRef.current = null;
    setSwipeDx(0);
    setIsSwiping(false);
  }

  let mainContent = null;

  if (route.name === "timeline") {
    mainContent = (
      <FadePage pageKey="timeline" direction={transitionDirection}>
        <TimelinePage
          locale={locale}
          memories={memories}
          loading={loading}
          error={error}
          syncing={syncing}
          integrityWarning={integrityWarning}
          cloudPlaceholders={cloudPlaceholders}
          syncIssues={syncIssues}
          syncMeta={syncMeta}
          onResyncNow={syncNow}
          onResyncActiveRing={syncActiveRingNow}
          onRecoverNow={syncNow}
          onOpenMemory={(memoryId) =>
            navigateTo({ name: "detail", memoryId }, "forward")
          }
          onOpenMemoryFromRing={openMemoryFromRingParams}
          showRingSignIn={
            !enforceSingleFlowCard &&
            !sessionLoading &&
            !supabaseSession &&
            !hideNfcPrompt
          }
          onRingSignedIn={async () => {
            setHideNfcPrompt(true);
            navigateTo({ name: "timeline", memoryId: null }, "forward");
            scheduleBackgroundSync();
          }}
          flowPrimaryUi={flowPrimaryUi}
          onFlowPrimaryAction={flowPrimaryAction}
          suppressSecondaryNotices={enforceSingleFlowCard}
          flowMainState={flowState.mainState}
        />
      </FadePage>
    );
  } else if (route.name === "explore") {
    mainContent = (
      <FadePage pageKey="explore" direction={transitionDirection}>
        <ExplorePage locale={locale} memories={memories} />
      </FadePage>
    );
  } else if (route.name === "rings") {
    mainContent = (
      <FadePage pageKey="rings" direction={transitionDirection}>
        <RingsPage
          locale={locale}
          onOpenRingSetup={openRingSetup}
          onOpenSettings={() =>
            navigateTo({ name: "settings", memoryId: null }, "forward")
          }
        />
      </FadePage>
    );
  } else if (route.name === "new") {
    mainContent = (
      <FadePage pageKey="new" direction={transitionDirection}>
        <NewMemoryPage
          locale={locale}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onSaveMemory={createMemory}
          onSaved={async () => {
            await refresh();
          }}
          onViewTimeline={() =>
            navigateTo({ name: "timeline", memoryId: null }, "back")
          }
        />
      </FadePage>
    );
  } else if (route.name === "detail") {
    mainContent = (
      <FadePage pageKey="detail" direction={transitionDirection}>
        <MemoryDetailPage
          locale={locale}
          memory={selectedMemory}
          loading={loading && !selectedMemory}
          error=""
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
        />
      </FadePage>
    );
  } else if (route.name === "settings") {
    mainContent = (
      <FadePage pageKey="settings" direction={transitionDirection}>
        <SettingsPage
          locale={locale}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onOpenHelp={() => navigateTo({ name: "help", memoryId: null }, "forward")}
          onLocalDataCleared={async () => {
            await refresh().catch(() => null);
          }}
        />
      </FadePage>
    );
  } else if (route.name === "help") {
    mainContent = (
      <FadePage pageKey="help" direction={transitionDirection}>
        <HelpCenterPage
          locale={locale}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
        />
      </FadePage>
    );
  } else {
    mainContent = (
      <FadePage pageKey="home" direction={transitionDirection}>
        <HomePage
          locale={locale}
          hasSession={Boolean(supabaseSession)}
          loading={loading || saving}
          message={error || ""}
          quickSignInError={quickSignInError}
          quickSigningIn={quickSigningIn}
          onQuickSignIn={handleQuickSignIn}
          onAfterOnboarding={handleAfterOnboarding}
          onOpenRingSetup={openRingSetup}
          onOpenTimeline={async () => {
            await refresh();
            navigateTo({ name: "timeline", memoryId: null }, "forward");
          }}
          onCreateMemory={() =>
            navigateTo({ name: "new", memoryId: null }, "forward")
          }
          onOpenSettings={() =>
            navigateTo({ name: "settings", memoryId: null }, "forward")
          }
          onOpenMemoryFromRing={openMemoryFromRingParams}
          flowPrimaryUi={flowPrimaryUi}
          onFlowPrimaryAction={flowPrimaryAction}
          suppressSecondaryNotices={enforceSingleFlowCard}
        />
      </FadePage>
    );
  }

  return (
    <>
      {renderWithShell(mainContent)}
      <RingSetupWizard
        key={ringSetupKey}
        open={ringSetupOpen}
        locale={locale}
        onClose={() => setRingSetupOpen(false)}
        onFinished={handleRingSetupFinished}
        onOpenSettings={() =>
          navigateTo({ name: "settings", memoryId: null }, "forward")
        }
      />
    </>
  );
}

function FadePage({ pageKey, children, direction }) {
  return (
    <div
      key={pageKey}
      style={{
        ...fadeStyles.container,
        animationName:
          direction === "back" ? "slideFadeInBack" : "slideFadeInForward",
      }}
    >
      {children}
    </div>
  );
}

const fadeStyles = {
  container: {
    animationDuration: "240ms",
    animationTimingFunction: "ease-out",
    animationFillMode: "both",
  },
};
