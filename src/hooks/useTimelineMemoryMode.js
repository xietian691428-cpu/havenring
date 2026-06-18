import { useEffect, useState } from "react";
import { getTimelineMemoryPollMs } from "@/lib/timeline-ios-guard";
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

  useEffect(() => {
    if (!isTimelineMemoryGuardActive()) return undefined;
    const sync = () => setPressure(readTimelineMemoryPressure());
    sync();
    const id = window.setInterval(sync, getTimelineMemoryPollMs());
    const onVisibility = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const textFirst = shouldUseTextFirstTimeline(pressure);

  return { pressure, textFirst };
}
