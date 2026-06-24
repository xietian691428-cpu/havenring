import { useEffect, useState } from "react";
import { getTimelineMemoryPollMs } from "@/lib/timeline-ios-guard";
import {
  markIosTimelineScrolled,
  shouldAllowIosTimelineThumbs,
  subscribeIosTimelineScroll,
} from "@/lib/ios-app-boot";
import {
  isTimelineMemoryGuardActive,
  readTimelineMemoryPressure,
  shouldUseTextFirstTimeline,
} from "@/lib/timeline-memory-guard";

/**
 * Lightweight iOS memory mode for Timeline — text-first when WebKit is tight.
 */
export function useTimelineMemoryMode() {
  const [pressure, setPressure] = useState(() =>
    isTimelineMemoryGuardActive() ? readTimelineMemoryPressure() : "normal"
  );
  const [, setThumbUnlockTick] = useState(0);

  useEffect(() => {
    if (!isTimelineMemoryGuardActive()) return undefined;
    const sync = () => setPressure(readTimelineMemoryPressure());
    sync();
    const id = window.setInterval(sync, getTimelineMemoryPollMs());
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const unsubScroll = subscribeIosTimelineScroll(() => {
      setThumbUnlockTick((n) => n + 1);
      sync();
    });
    const root = document.querySelector(".haven-app-main-scroll");
    const onScroll = () => markIosTimelineScrolled();
    root?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubScroll();
      root?.removeEventListener("scroll", onScroll);
    };
  }, []);

  const textFirst = shouldUseTextFirstTimeline(pressure);
  const thumbsAllowed = shouldAllowIosTimelineThumbs();

  return { pressure, textFirst, thumbsAllowed };
}
