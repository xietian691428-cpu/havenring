"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppChrome } from "./components/AppChrome";
import { HomePage } from "./pages/HomePage";
import { TimelinePage } from "./pages/TimelinePage";
import { NewMemoryPage } from "./pages/NewMemoryPage";
import { MemoryDetailPage } from "./pages/MemoryDetailPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpCenterPage } from "./pages/HelpCenterPage";
import { useMemories } from "./hooks/useMemories";
import { usePwaLocale } from "./i18n/pwaLocale";

export default function App() {
  const [route, setRoute] = useState({ name: "home", memoryId: null });
  const [transitionDirection, setTransitionDirection] = useState("forward");
  const [swipeDx, setSwipeDx] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const locale = usePwaLocale();
  const touchStartRef = useRef(null);
  const {
    memories,
    loading,
    saving,
    error,
    refresh,
    createMemory,
  } = useMemories();

  const selectedMemory = useMemo(
    () => memories.find((m) => m.id === route.memoryId) || null,
    [memories, route.memoryId]
  );

  const shellProps = {
    locale,
    current: route.name,
    onNavigateHome: () => navigateTo({ name: "home", memoryId: null }, "back"),
    onNavigateTimeline: async () => {
      await refresh();
      navigateTo({ name: "timeline", memoryId: null }, "back");
    },
    onNavigateSettings: () => navigateTo({ name: "settings", memoryId: null }, "forward"),
    onNavigateHelp: () => navigateTo({ name: "help", memoryId: null }, "forward"),
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

  async function openMemoryFromRingParams(memoryId) {
    if (!memoryId) return;
    await refresh();
    navigateTo({ name: "detail", memoryId }, "forward");
  }

  // Fixed ring URL entrypoint support: /hub?memoryId=... or /?memory=...
  // Ring remains a long-term key and does not need per-save rewrites.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId = params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    void openMemoryFromRingParams(memoryId);
    // Intentionally run once on first mount for entry URL handling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goBackByRoute() {
    if (route.name === "detail" || route.name === "new") {
      navigateTo({ name: "timeline", memoryId: null }, "back");
      return;
    }
    if (route.name === "timeline") {
      navigateTo({ name: "home", memoryId: null }, "back");
    }
  }

  function handleTouchStart(event) {
    if (route.name === "home") return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    // Edge swipe only: avoids accidental back while interacting with content.
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
    if (route.name === "home") return;
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
    if (route.name === "home") return;
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

  if (route.name === "timeline") {
    return renderWithShell(
        <FadePage pageKey="timeline" direction={transitionDirection}>
          <TimelinePage
            locale={locale}
            memories={memories}
            loading={loading}
            error={error}
            onBackHome={() => navigateTo({ name: "home", memoryId: null }, "back")}
            onCreateNew={() => navigateTo({ name: "new", memoryId: null }, "forward")}
            onOpenSettings={() => navigateTo({ name: "settings", memoryId: null }, "forward")}
            onOpenMemory={(memoryId) =>
              navigateTo({ name: "detail", memoryId }, "forward")
            }
            onOpenMemoryFromRing={openMemoryFromRingParams}
          />
        </FadePage>
    );
  }

  if (route.name === "new") {
    return renderWithShell(
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
  }

  if (route.name === "detail") {
    return renderWithShell(
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
  }

  if (route.name === "settings") {
    return renderWithShell(
      <FadePage pageKey="settings" direction={transitionDirection}>
        <SettingsPage
          locale={locale}
          onBack={() => navigateTo({ name: "home", memoryId: null }, "back")}
          onOpenHelp={() => navigateTo({ name: "help", memoryId: null }, "forward")}
        />
      </FadePage>
    );
  }

  if (route.name === "help") {
    return renderWithShell(
      <FadePage pageKey="help" direction={transitionDirection}>
        <HelpCenterPage
          locale={locale}
          onBack={() => navigateTo({ name: "home", memoryId: null }, "back")}
        />
      </FadePage>
    );
  }

  return renderWithShell(
    <FadePage pageKey="home" direction={transitionDirection}>
      <HomePage
        locale={locale}
        loading={loading || saving}
        message={error || ""}
        onOpenTimeline={async () => {
          await refresh();
          navigateTo({ name: "timeline", memoryId: null }, "forward");
        }}
        onCreateMemory={() => navigateTo({ name: "new", memoryId: null }, "forward")}
        onOpenSettings={() => navigateTo({ name: "settings", memoryId: null }, "forward")}
        onOpenMemoryFromRing={openMemoryFromRingParams}
      />
    </FadePage>
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
