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
import { readPwaInstallDeferred } from "../lib/pwaInstallKeys";
import { canUseFeature, getSubscriptionLabel } from "../features/subscription";
import { useMemoriesContext, MemoriesProvider } from "../providers/MemoriesProvider";
import { getMemoryById } from "../services/localStorageService";
import { useRingRegistryContext } from "../providers/RingProvider";
import { useSessionContext } from "../providers/SessionProvider";
import { useSubscriptionContext } from "../providers/SubscriptionProvider";
import dynamic from "next/dynamic";
import { MemoryComposerErrorBoundary } from "../components/MemoryComposerErrorBoundary";
import { usePwaLocale } from "../i18n/pwaLocale";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { canonicalAuthOriginFromLocation } from "../../lib/auth-redirect";
import { useAppFlow } from "../state/appFlowContext";
import { getFlowPrimaryUi, getRecoveryActionIntent } from "../state/appFlowSelectors";
import { getSecuritySummary } from "../services/deviceTrustService";
import { FIRST_MEMORY_DONE_KEY } from "../services/firstRunTelemetryService";
import { getBoundRingCount } from "../services/ringRegistryService";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  isTemporaryDeviceModeEnabled,
  TEMP_DEVICE_MODE_EVENT,
  wipeTemporaryDevice,
} from "../services/temporaryDeviceService";
import { shouldAllowTimelinePullRefresh } from "@/lib/ios-app-boot";
import { markTabTimelineRefreshClaimed } from "@/lib/timeline-refresh-guard";

function RoutePageSkeleton({ label }: { label: string }) {
  return (
    <main
      style={{
        minHeight: "50vh",
        display: "grid",
        placeItems: "center",
        color: "#d9c3b3",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <p style={{ margin: 0 }}>{label}</p>
    </main>
  );
}

const NewMemoryPage = dynamic(
  () => import("../views/NewMemoryPage").then((mod) => mod.NewMemoryPage),
  {
    ssr: false,
    loading: () => (
      <main
        style={{
          minHeight: "60vh",
          display: "grid",
          placeItems: "center",
          color: "#d9c3b3",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0 }}>Loading editor…</p>
      </main>
    ),
  }
);

const TimelinePage = dynamic(
  () => import("../views/TimelinePage").then((mod) => mod.TimelinePage),
  {
    ssr: false,
    loading: () => (
      <main
        style={{
          minHeight: "50vh",
          display: "grid",
          placeItems: "center",
          color: "#d9c3b3",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <p style={{ margin: 0 }}>Loading memories…</p>
      </main>
    ),
  }
);

const ExplorePage = dynamic(
  () => import("../views/ExplorePage").then((mod) => mod.ExplorePage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading explore…" /> }
);

const HomePage = dynamic(
  () => import("../views/HomePage").then((mod) => mod.HomePage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading…" /> }
);

const RingsPage = dynamic(
  () => import("../views/RingsPage").then((mod) => mod.RingsPage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading rings…" /> }
);

const MemoryDetailPage = dynamic(
  () => import("../views/MemoryDetailPage").then((mod) => mod.MemoryDetailPage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading memory…" /> }
);

const SettingsPage = dynamic(
  () => import("../views/SettingsPage").then((mod) => mod.SettingsPage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading settings…" /> }
);

const PricingPage = dynamic(
  () => import("../views/PricingPage").then((mod) => mod.PricingPage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading pricing…" /> }
);

const HelpCenterPage = dynamic(
  () => import("../views/HelpCenterPage").then((mod) => mod.HelpCenterPage),
  { ssr: false, loading: () => <RoutePageSkeleton label="Loading help…" /> }
);

type Route =
  | { name: "home"; memoryId: null }
  | { name: "timeline"; memoryId: null }
  | { name: "explore"; memoryId: null }
  | { name: "rings"; memoryId: null }
  | { name: "new"; memoryId: string | null; autoSeal?: boolean; fromDraftId?: string }
  | { name: "settings"; memoryId: null }
  | { name: "pricing"; memoryId: null }
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

  return (
    <MemoriesProvider timelineLifecycleActive={route.name === "timeline"}>
      <AppRouterInner
        route={route}
        setRoute={setRoute}
        transitionDirection={transitionDirection}
        setTransitionDirection={setTransitionDirection}
        swipeDx={swipeDx}
        setSwipeDx={setSwipeDx}
        isSwiping={isSwiping}
        setIsSwiping={setIsSwiping}
      />
    </MemoriesProvider>
  );
}

type AppRouterInnerProps = {
  route: Route;
  setRoute: (route: Route) => void;
  transitionDirection: "forward" | "back";
  setTransitionDirection: (direction: "forward" | "back") => void;
  swipeDx: number;
  setSwipeDx: (dx: number) => void;
  isSwiping: boolean;
  setIsSwiping: (swiping: boolean) => void;
};

function AppRouterInner({
  route,
  setRoute,
  transitionDirection,
  setTransitionDirection,
  swipeDx,
  setSwipeDx,
  isSwiping,
  setIsSwiping,
}: AppRouterInnerProps) {
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
    loadMoreMemories,
    timelineHasMore,
    loadingMore,
    searchMemories,
    syncNow,
    syncLightNow,
    syncDeepNow,
    syncActiveRingNow,
    persistComposerMemory,
    deleteMemory,
    queueBackgroundSync,
  } = useMemoriesContext();
  const { session: supabaseSession, sessionLoading } = useSessionContext();
  const { entitlements } = useSubscriptionContext();
  const { boundRingCount, bumpRingRegistry } = useRingRegistryContext();
  const [hideNfcPrompt, setHideNfcPrompt] = useState(false);
  const [quickSigningIn, setQuickSigningIn] = useState(false);
  const [quickSignInError, setQuickSignInError] = useState("");
  const [temporaryModeBanner, setTemporaryModeBanner] = useState(() =>
    isTemporaryDeviceModeEnabled()
  );
  const { flowState, dispatchFlow } = useAppFlow() as {
    flowState: MinimalFlowState;
    dispatchFlow: AppFlowDispatch;
  };
  const loginSyncDoneForSessionRef = useRef("");
  const tempWipeStartedRef = useRef(false);
  const tabTimelineBusyRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.documentElement.classList.add("haven-app-route");
    document.body.classList.add("haven-app-route");
    return () => {
      document.documentElement.classList.remove("haven-app-route");
      document.body.classList.remove("haven-app-route");
    };
  }, []);

  function navigateTo(nextRoute: Route, direction: "forward" | "back" = "forward") {
    setTransitionDirection(direction);
    setRoute(nextRoute);
  }

  function openRingSetup() {
    if (typeof window !== "undefined") {
      window.location.assign("/bind-ring");
    }
  }

  const selectedMemory = useMemo(() => {
    return (
      (memories as Array<{ id: string }>).find((m) => m.id === route.memoryId) ??
      null
    );
  }, [memories, route.memoryId]);

  const [detailMemory, setDetailMemory] = useState(null);
  useEffect(() => {
    if (route.name !== "detail" || !route.memoryId) {
      setDetailMemory(null);
      return undefined;
    }
    let active = true;
    void getMemoryById(String(route.memoryId)).then((row) => {
      if (active) setDetailMemory(row);
    });
    return () => {
      active = false;
    };
  }, [route.name, route.memoryId]);
  const flowPrimaryUi = useMemo(() => getFlowPrimaryUi(flowState), [flowState]);
  const handleTimelinePullRefresh = useCallback(async () => {
    if (!shouldAllowTimelinePullRefresh()) {
      await refresh({ force: true });
      return;
    }
    try {
      await Promise.race([
        syncLightNow({ pullRefresh: true }),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("pull_sync_timeout")), 12_000);
        }),
      ]);
    } catch {
      await refresh({ force: true });
    }
  }, [refresh, syncLightNow]);
  const enforceSingleFlowCard = Boolean(flowPrimaryUi?.enforceSingle);

  const flowPrimaryAction = useCallback(
    (intent: string = "primary") => {
      if (!flowPrimaryUi) return;
      if (flowState.mainState === "SYNC_GATE") {
        void syncNow();
        return;
      }
      if (flowState.mainState === "PWA_INSTALL_GATE") {
        if (intent === "defer_pwa") {
          dispatchFlow({ type: "PWA_DEFERRED" });
          return;
        }
        const returnPath =
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : "/app";
        window.location.assign(
          `/setup?return=${encodeURIComponent(returnPath || "/app")}`
        );
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

  function handleAfterOnboarding(detail = {}) {
    if (typeof window === "undefined") return;
    if (detail.choice === "bind_ring") {
      openRingSetup();
      return;
    }
    navigateTo({ name: "timeline", memoryId: null }, "forward");
    markTabTimelineRefreshClaimed();
    void refresh();
  }

  const activeTab = useMemo((): ActiveTab => {
    if (route.name === "explore") return "explore";
    if (route.name === "rings") return "rings";
    if (route.name === "new") return "seal";
    return "timeline";
  }, [route.name]);

  const immersiveRoute = ["new", "detail", "help", "pricing"].includes(route.name);
  const showBottomNav = !immersiveRoute;
  const showTopChrome = !immersiveRoute;
  const chromeResetKey = `${route.name}:${route.memoryId ?? ""}`;

  const shellProps = useMemo(
    (): ComponentProps<typeof AppChrome> => ({
      locale,
      showBottomNav,
      showTopChrome,
      chromeResetKey,
      activeTab,
      onTabTimeline: () => {
        if (route.name === "timeline") {
          if (memories.length === 0) {
            void refresh({ force: true });
          }
          return;
        }
        if (tabTimelineBusyRef.current) return;
        tabTimelineBusyRef.current = true;
        markTabTimelineRefreshClaimed();
        navigateTo({ name: "timeline", memoryId: null }, "back");
        void refresh({ force: true }).finally(() => {
          tabTimelineBusyRef.current = false;
        });
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
      showTopChrome,
      chromeResetKey,
      activeTab,
      route.name,
      refresh,
      memories,
      temporaryModeBanner,
      supabaseSession,
      boundRingCount,
      entitlements,
    ]
  );

  function renderWithShell(content: ReactNode) {
    const swipeActive = isSwiping || swipeDx > 0;
    const dragStyle = swipeActive
      ? {
          transform: `translateX(${swipeDx}px)`,
          transition: isSwiping ? "none" : "transform 220ms ease-out",
          willChange: "transform" as const,
        }
      : undefined;

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
    queueBackgroundSync("session");
  }, [queueBackgroundSync]);

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
        : `${origin}/app?onboarding_auth=1`;
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

  function openTimelineFromComposer() {
    markTabTimelineRefreshClaimed();
    navigateTo({ name: "timeline", memoryId: null }, "back");
    void refresh({ force: true });
  }

  async function openMemoryFromRingParams(memoryId: string | null | undefined) {
    if (!memoryId) return;
    await refresh({ force: true });
    navigateTo({ name: "detail", memoryId }, "forward");
  }

  async function openMostRecentDraft() {
    const { listDraftItems } = await import("../features/memories/draftBoxStore");
    const drafts = await listDraftItems();
    if (!drafts.length) {
      navigateTo({ name: "new", memoryId: null }, "forward");
      return;
    }
    navigateTo(
      { name: "new", memoryId: null, fromDraftId: drafts[0].id },
      "forward"
    );
  }

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "1";
    if (done) return;
    queueMicrotask(() => {
      setRoute({ name: "home", memoryId: null });
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const openBind =
      params.get("open") === "bind" ||
      params.get("open") === "ring" ||
      params.get("bind") === "1";
    if (openBind) {
      params.delete("open");
      params.delete("bind");
      const qs = params.toString();
      window.location.assign(qs ? `/bind-ring?${qs}` : "/bind-ring");
      return;
    }
    const fromDraftId = String(
      params.get("fromDraft") || params.get("draft") || ""
    ).trim();
    const openNew =
      params.get("open") === "new" ||
      params.get("seal") === "1" ||
      params.get("seal") === "new" ||
      Boolean(fromDraftId);
    const autoSeal =
      params.get("autoSeal") === "true" || params.get("autoSeal") === "1";
    if (params.get("ring") === "signin") {
      navigateTo({ name: "home", memoryId: null }, "forward");
      return;
    }
    if (openNew) {
      navigateTo(
        { name: "new", memoryId: null, autoSeal, fromDraftId: fromDraftId || undefined },
        "forward"
      );
      params.delete("open");
      params.delete("seal");
      params.delete("fromDraft");
      params.delete("draft");
      params.delete("autoSeal");
      const qs = params.toString();
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
      return;
    }
    const memoryId =
      params.get("memoryId") ?? params.get("memory") ?? params.get("m");
    if (!memoryId) return;
    void openMemoryFromRingParams(memoryId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot deep link hydration
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let unbindBoundary = () => undefined;
    let cancelled = false;
    void import("../features/seal/sealSessionBoundary").then((boundary) => {
      if (cancelled) return;
      unbindBoundary = boundary.bindSealSessionBoundaryListeners();
    });
    const syncOrphans = () => {
      if (document.visibilityState !== "visible") return;
      void import("../features/seal/sealFlowClient").then((sealFlow) => {
        sealFlow.syncSealPrepWithSessionArm();
      });
    };
    document.addEventListener("visibilitychange", syncOrphans);
    void import("../features/seal/sealFlowClient").then((sealFlow) => {
      if (!cancelled) sealFlow.syncSealPrepWithSessionArm();
    });
    return () => {
      cancelled = true;
      unbindBoundary();
      document.removeEventListener("visibilitychange", syncOrphans);
    };
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
    const isTouchMac = ua.includes("macintosh") && "ontouchend" in window;
    const platform = /iphone|ipad|ipod/.test(ua) || isTouchMac
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
      pwaDeferred: readPwaInstallDeferred(),
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
      hasBoundRing: boundRingCount > 0,
    });
  }, [supabaseSession, boundRingCount, dispatchFlow]);

  useEffect(() => {
    dispatchFlow({ type: "SYNC_STATUS", syncing: Boolean(syncing) });
    if (syncHealth?.severity === "hard" && syncHealth.reason === "auth_expired") {
      if (supabaseSession && !sessionLoading) {
        dispatchFlow({ type: "SYNC_RECOVERED" });
        return;
      }
      dispatchFlow({
        type: "SYNC_HARD_FAILED",
        errorType: "auth_expired",
      });
      return;
    }
    dispatchFlow({ type: "SYNC_RECOVERED" });
  }, [syncing, syncHealth, supabaseSession, sessionLoading, dispatchFlow]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ftuxWelcomeDone =
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "1";
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
    if (route.name === "pricing") {
      navigateTo({ name: "settings", memoryId: null }, "back");
      return;
    }
    if (route.name === "detail" || route.name === "new") {
      navigateTo({ name: "timeline", memoryId: null }, "back");
      return;
    }
    if (route.name === "help") {
      navigateTo({ name: "timeline", memoryId: null }, "back");
    }
  }

  function handleTouchStart(event: TouchEvent) {
    if (!["detail", "new", "help", "pricing"].includes(route.name)) return;
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
          onPullRefresh={handleTimelinePullRefresh}
          onLoadMore={loadMoreMemories}
          hasMoreMemories={timelineHasMore}
          loadingMore={loadingMore}
          onSearchMemories={searchMemories}
          onResyncActiveRing={syncActiveRingNow}
          onRecoverNow={syncNow}
          onOpenMemory={(memoryId) =>
            navigateTo({ name: "detail", memoryId }, "forward")
          }
          onCreateMemory={() =>
            navigateTo({ name: "new", memoryId: null }, "forward")
          }
          onImportDraft={() => {
            void openMostRecentDraft();
          }}
          onOpenMemoryFromRing={openMemoryFromRingParams}
          flowPrimaryUi={flowPrimaryUi}
          onFlowPrimaryAction={flowPrimaryAction}
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
          onOpenHelp={() => navigateTo({ name: "help", memoryId: null }, "forward")}
        />
      </FadePage>
    );
  } else if (route.name === "new") {
    mainContent = (
      <FadePage pageKey={`new-${route.memoryId ?? "create"}`} direction={transitionDirection}>
        <MemoryComposerErrorBoundary>
          <NewMemoryPage
            locale={locale}
            userEntitlements={entitlements}
            autoSealMode={Boolean(route.autoSeal)}
            initialEditMemory={
              route.memoryId
                ? ((memories as Array<{ id: string }>).find((m) => m.id === route.memoryId) ??
                  null)
                : null
            }
            initialDraftId={route.fromDraftId || ""}
            onBack={openTimelineFromComposer}
            onSaveMemory={persistComposerMemory}
            onSaved={async () => {
              await refresh({ force: true });
            }}
            onOpenHelp={() =>
              navigateTo({ name: "help", memoryId: null }, "forward")
            }
            onOpenSettings={() =>
              navigateTo({ name: "settings", memoryId: null }, "forward")
            }
          />
        </MemoryComposerErrorBoundary>
      </FadePage>
    );
  } else if (route.name === "detail") {
    mainContent = (
      <FadePage pageKey="detail" direction={transitionDirection}>
        <MemoryDetailPage
          locale={locale}
          memory={detailMemory ?? selectedMemory}
          loading={loading && !(detailMemory ?? selectedMemory)}
          error=""
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onEdit={() => {
            const id = selectedMemory?.id;
            if (!id) return;
            navigateTo({ name: "new", memoryId: id }, "forward");
          }}
          onDeleteMemory={async (id: string) => {
            try {
              await deleteMemory(id);
              await refresh({ force: true }).catch(() => null);
              navigateTo({ name: "timeline", memoryId: null }, "back");
            } catch {
              /* useMemories surfaces delete errors via `error` if needed */
            }
          }}
          onMemoryUpdated={async (updated) => {
            if (updated) {
              setDetailMemory(updated);
            } else if (route.memoryId) {
              const row = await getMemoryById(String(route.memoryId));
              setDetailMemory(row);
            }
            await refresh({ force: true }).catch(() => null);
          }}
        />
      </FadePage>
    );
  } else if (route.name === "settings") {
    mainContent = (
      <FadePage pageKey="settings" direction={transitionDirection}>
        <SettingsPage
          locale={locale}
          userEntitlements={entitlements}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onOpenHelp={() =>
            navigateTo({ name: "help", memoryId: null }, "forward")
          }
          onOpenPricing={() =>
            navigateTo({ name: "pricing", memoryId: null }, "forward")
          }
          onOpenRings={() =>
            navigateTo({ name: "rings", memoryId: null }, "forward")
          }
          onLocalDataCleared={async () => {
            await refresh({ force: true }).catch(() => null);
          }}
          onDeepSync={async () => {
            await syncDeepNow();
            await refresh({ force: true }).catch(() => null);
          }}
        />
      </FadePage>
    );
  } else if (route.name === "pricing") {
    mainContent = (
      <FadePage pageKey="pricing" direction={transitionDirection}>
        <PricingPage
          onBack={() => navigateTo({ name: "settings", memoryId: null }, "back")}
          onStartTrial={() => {
            openRingSetup();
          }}
          onSubscribe={() =>
            navigateTo({ name: "settings", memoryId: null }, "forward")
          }
        />
      </FadePage>
    );
  } else if (route.name === "help") {
    mainContent = (
      <FadePage pageKey="help" direction={transitionDirection}>
        <HelpCenterPage
          locale={locale}
          onBack={() => navigateTo({ name: "timeline", memoryId: null }, "back")}
          onOpenRings={() =>
            navigateTo({ name: "rings", memoryId: null }, "forward")
          }
          onOpenSettings={() =>
            navigateTo({ name: "settings", memoryId: null }, "forward")
          }
          onOpenPricing={() =>
            navigateTo({ name: "pricing", memoryId: null }, "forward")
          }
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
          onOpenTimeline={() => {
            if (tabTimelineBusyRef.current) return;
            tabTimelineBusyRef.current = true;
            markTabTimelineRefreshClaimed();
            navigateTo({ name: "timeline", memoryId: null }, "forward");
            void refresh().finally(() => {
              tabTimelineBusyRef.current = false;
            });
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

  return renderWithShell(mainContent);
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
