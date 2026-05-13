// @ts-nocheck — orchestrates legacy JS views; tighten types when views migrate to TS.
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type TouchEvent,
} from "react";
import { AppChrome, type ActiveTab } from "./AppChrome";
import {
  RingSetupWizard,
  RING_SETUP_DISMISSED_KEY,
} from "../components/RingSetupWizard";
import { canUseFeature, getSubscriptionLabel } from "../features/subscription";
import { useMemories } from "../hooks/useMemories";
import { useRingRegistryContext } from "../providers/RingProvider";
import { useSessionContext } from "../providers/SessionProvider";
import { useSubscriptionContext } from "../providers/SubscriptionProvider";
import { ExplorePage } from "../views/ExplorePage";
import { HelpCenterPage } from "../views/HelpCenterPage";
import { HomePage } from "../views/HomePage";
import { MemoryDetailPage } from "../views/MemoryDetailPage";
import { NewMemoryPage } from "../views/NewMemoryPage";
import { RingsPage } from "../views/RingsPage";
import { SettingsPage } from "../views/SettingsPage";
import { TimelinePage } from "../views/TimelinePage";
import { usePwaLocale } from "../i18n/pwaLocale";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { canonicalAuthOriginFromLocation } from "../../lib/auth-redirect";
import { useAppFlow } from "../state/appFlowContext";
import { getFlowPrimaryUi, getRecoveryActionIntent } from "../state/appFlowSelectors";
import { getSecuritySummary } from "../services/deviceTrustService";
import { FIRST_MEMORY_DONE_KEY } from "../services/firstRunTelemetryService";
import { getBoundRingCount } from "../services/ringRegistryService";
import {
  isTemporaryDeviceModeEnabled,
  TEMP_DEVICE_MODE_EVENT,
  wipeTemporaryDevice,
} from "../services/temporaryDeviceService";
import { scheduleWelcomeToast } from "../utils/welcomeToast";

type Route =
  | { name: "home"; memoryId: null }
  | { name: "timeline"; memoryId: null }
  | { name: "explore"; memoryId: null }
  | { name: "rings"; memoryId: null }
  | { name: "new"; memoryId: null }
  | { name: "settings"; memoryId: null }
  | { name: "help"; memoryId: null }
  | { name: "detail"; memoryId: string };

type AppFlowDispatch = (action: Record<string, unknown> & { type: string }) => void;

type MinimalFlowState = {
  mainState: string;
  recoveryErrorType?: string;
  pwaInstalled?: boolean;
  pwaDeferred?: boolean;
};

export function AppRouter() {
  const [route, setRoute] = useState<Route>({ name: "timeline", memoryId: null });
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "back">(
    "forward"
  );
  const [swipeDx, setSwipeDx] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const locale = usePwaLocale();
  const touchStartRef = useRef<{ x: number; y: number; ts: number } | null>(null);
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
  const { session: supabaseSession, sessionLoading } = useSessionContext();
  const { entitlements } = useSubscriptionContext();
  const { boundRingCount, bumpRingRegistry } = useRingRegistryContext();
  const [hideNfcPrompt, setHideNfcPrompt] = useState(false);
  const [quickSigningIn, setQuickSigningIn] = useState(false);
  const [quickSignInError, setQuickSignInError] = useState("");
  const [ringSetupOpen, setRingSetupOpen] = useState(false);
  const [ringSetupKey, setRingSetupKey] = useState(0);
  const [temporaryModeBanner, setTemporaryModeBanner] = useState(() =>
    isTemporaryDeviceModeEnabled()
  );
  const { flowState, dispatchFlow } = useAppFlow() as {
    flowState: MinimalFlowState;
    dispatchFlow: AppFlowDispatch;
  };
  const loginSyncDoneForSessionRef = useRef("");
  const tempWipeStartedRef = useRef(false);

  function navigateTo(nextRoute: Route, direction: "forward" | "back" = "forward") {
    setTransitionDirection(direction);
    setRoute(nextRoute);
  }

  function openRingSetup() {
    setRingSetupKey((k) => k + 1);
    setRingSetupOpen(true);
  }

  const selectedMemory = useMemo(() => {
    return (
      (memories as Array<{ id: string }>).find((m) => m.id === route.memoryId) ??
      null
    );
  }, [memories, route.memoryId]);
  const flowPrimaryUi = useMemo(() => getFlowPrimaryUi(flowState), [flowState]);
  const enforceSingleFlowCard = Boolean(flowPrimaryUi?.enforceSingle);

  const flowPrimaryAction = useCallback(
    (intent: string = "primary") => {
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
    },
    [
      flowPrimaryUi,
      flowState.mainState,
      flowState.recoveryErrorType,
      dispatchFlow,
      syncNow,
    ]
  );

  function handleAfterOnboarding() {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(RING_SETUP_DISMISSED_KEY) === "1";
    if (!dismissed && boundRingCount === 0) {
      openRingSetup();
    }
  }

  function handleRingSetupFinished(payload: { nickname?: string } | undefined) {
    const nickname = payload?.nickname ?? "friend";
    scheduleWelcomeToast({ nickname });
    setRingSetupOpen(false);
    navigateTo({ name: "timeline", memoryId: null }, "forward");
    void refresh();
    bumpRingRegistry();
  }

  const activeTab = useMemo((): ActiveTab => {
    if (route.name === "explore") return "explore";
    if (route.name === "rings") return "rings";
    if (route.name === "new") return "seal";
    return "timeline";
  }, [route.name]);

  const showBottomNav = !["new", "detail", "help"].includes(route.name);

  const shellProps = useMemo(
    (): ComponentProps<typeof AppChrome> => ({
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
      onNavigateHelp: () =>
        navigateTo({ name: "help", memoryId: null }, "forward"),
      showTemporaryBanner: temporaryModeBanner,
      statusSignedIn: Boolean(supabaseSession),
      statusRingBound: boundRingCount > 0,
      statusSealRequiresRing: Boolean(
        canUseFeature(entitlements, "seal_with_ring") && boundRingCount > 0
      ),
      subscriptionLabel: getSubscriptionLabel(entitlements),
    }),
    [
      locale,
      showBottomNav,
      activeTab,
      refresh,
      temporaryModeBanner,
      supabaseSession,
      boundRingCount,
      entitlements,
    ]
  );

  function renderWithShell(content: ReactNode) {
    const dragStyle = {
      transform: swipeDx > 0 ? `translateX(${swipeDx}px)` : "translateX(0px)",
      transition: isSwiping ? "none" : "transform 220ms ease-out",
      willChange: "transform" as const,
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

  const scheduleBackgroundSync = useCallback(() => {
    const run = () => {
      void syncNow().catch(() => null);
      void refresh().catch(() => null);
    };
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(run, { timeout: 1500 });
      return;
    }
    setTimeout(run, 400);
  }, [syncNow, refresh]);

  async function handleQuickSignIn(provider: "apple" | "google", token: string) {
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
      const origin = canonicalAuthOriginFromLocation();
      const redirectTo = token
        ? `${origin}/hub?token=${encodeURIComponent(token)}`
        : `${origin}/app`;
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

  async function openMemoryFromRingParams(memoryId: string | null | undefined) {
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
      params.get("memoryId") ?? params.get("memory") ?? params.get("m");
    if (!memoryId) return;
    void openMemoryFromRingParams(memoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link hydration
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
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const pwaInstalled = Boolean(
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
        nav.standalone === true
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
  }, [supabaseSession, dispatchFlow]);

  useEffect(() => {
    dispatchFlow({
      type: "SESSION_CHANGED",
      hasSession: Boolean(supabaseSession),
    });
    dispatchFlow({
      type: "RINGS_CHANGED",
      hasBoundRing: getBoundRingCount() > 0,
    });
  }, [supabaseSession, ringSetupOpen, route.name, dispatchFlow]);

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
        errorType: syncHealth.reason ?? "auth_expired",
      });
      return;
    }
    dispatchFlow({ type: "SYNC_RECOVERED" });
  }, [syncing, syncHealth, supabaseSession, sessionLoading, dispatchFlow]);

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
    const onModeChanged = (evt: Event) => {
      const ce = evt as CustomEvent<{ enabled?: boolean }>;
      const enabled = Boolean(ce?.detail?.enabled);
      setTemporaryModeBanner(enabled);
    };
    const onStorage = (evt: StorageEvent) => {
      if (evt.key === "haven.session.temporaryDevice.v1") {
        setTemporaryModeBanner(isTemporaryDeviceModeEnabled());
      }
    };
    window.addEventListener(TEMP_DEVICE_MODE_EVENT, onModeChanged as EventListener);
    window.addEventListener("storage", onStorage as EventListener);
    return () => {
      window.removeEventListener(TEMP_DEVICE_MODE_EVENT, onModeChanged as EventListener);
      window.removeEventListener("storage", onStorage as EventListener);
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

  function handleTouchStart(event: TouchEvent) {
    if (!["detail", "new", "help"].includes(route.name)) return;
    const touch = event.changedTouches[0];
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

  function handleTouchMove(event: TouchEvent) {
    const start = touchStartRef.current;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = Math.max(0, touch.clientX - start.x);
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaY > 64) {
      setSwipeDx(0);
      return;
    }
    setSwipeDx(Math.min(deltaX, 120));
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
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

  let mainContent: ReactNode = null;

  if (route.name === "timeline") {
    mainContent = (
      <FadePage pageKey="timeline" direction={transitionDirection}>
        <TimelinePage
          locale={locale}
          memories={memories}
          loading={loading}
          error={error ?? ""}
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
          onCreateMemory={() =>
            navigateTo({ name: "new", memoryId: null }, "forward")
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
          userEntitlements={entitlements}
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
          userEntitlements={entitlements}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onSaveMemory={createMemory}
          onSaved={async () => {
            await refresh();
          }}
          onViewTimeline={() =>
            navigateTo({ name: "timeline", memoryId: null }, "back")
          }
          onOpenHelp={() =>
            navigateTo({ name: "help", memoryId: null }, "forward")
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
          onOpenHelp={() =>
            navigateTo({ name: "help", memoryId: null }, "forward")
          }
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

function FadePage({
  pageKey,
  children,
  direction,
}: {
  pageKey: string;
  children: ReactNode;
  direction: "forward" | "back";
}) {
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
