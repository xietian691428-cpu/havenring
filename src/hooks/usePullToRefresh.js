import { useCallback, useEffect, useRef, useState } from "react";
import { getTimelinePullRefreshCooldownMs } from "@/lib/timeline-ios-guard";

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 112;
const HORIZONTAL_CANCEL_PX = 16;
const MIN_VERTICAL_START_PX = 6;

/**
 * Native-style pull-to-refresh when the page is scrolled to the top.
 */
export function usePullToRefresh({ onRefresh, disabled = false }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const trackingRef = useRef(false);
  const verticalIntentRef = useRef(false);
  const busyRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const reset = useCallback(() => {
    startYRef.current = 0;
    startXRef.current = 0;
    trackingRef.current = false;
    verticalIntentRef.current = false;
    pullDistanceRef.current = 0;
    setPullDistance(0);
  }, []);

  useEffect(() => {
    if (disabled || typeof window === "undefined") return undefined;

    function canTrack() {
      const scroller = document.scrollingElement || document.documentElement;
      return Number(scroller?.scrollTop || window.scrollY || 0) <= 4;
    }

    function onTouchStart(event) {
      if (busyRef.current) return;
      if (!canTrack()) return;
      startXRef.current = event.touches[0]?.clientX ?? 0;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      trackingRef.current = true;
      verticalIntentRef.current = false;
    }

    function onTouchMove(event) {
      if (!trackingRef.current || busyRef.current) return;
      if (!canTrack()) {
        reset();
        return;
      }
      const currentX = event.touches[0]?.clientX ?? 0;
      const currentY = event.touches[0]?.clientY ?? 0;
      const deltaX = currentX - startXRef.current;
      const deltaY = currentY - startYRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Avoid conflict with horizontal swipe-back / carousel gestures.
      if (!verticalIntentRef.current && absX > HORIZONTAL_CANCEL_PX && absX > absY) {
        reset();
        return;
      }
      if (!verticalIntentRef.current && absY >= MIN_VERTICAL_START_PX && absY > absX) {
        verticalIntentRef.current = true;
      }

      if (!verticalIntentRef.current) return;
      const delta = deltaY;
      if (delta <= 0) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const next = Math.min(delta, MAX_PULL_PX);
      pullDistanceRef.current = next;
      setPullDistance(next);
    }

    async function onTouchEnd() {
      if (!trackingRef.current || busyRef.current) {
        reset();
        return;
      }
      const shouldRefresh = pullDistanceRef.current >= PULL_THRESHOLD_PX;
      reset();
      if (!shouldRefresh || !onRefreshRef.current) return;

      const cooldownMs = getTimelinePullRefreshCooldownMs();
      const sinceLast = Date.now() - lastRefreshAtRef.current;
      if (sinceLast < cooldownMs) return;

      busyRef.current = true;
      lastRefreshAtRef.current = Date.now();
      setRefreshing(true);
      try {
        await onRefreshRef.current();
      } finally {
        busyRef.current = false;
        setRefreshing(false);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, reset]);

  const active = refreshing || pullDistance > 8;
  const progress = Math.min(1, pullDistance / PULL_THRESHOLD_PX);

  return {
    pullDistance,
    refreshing,
    active,
    progress,
  };
}
