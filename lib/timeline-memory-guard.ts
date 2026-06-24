/**
 * Timeline memory pressure — iOS heuristics + composer pressure fallback.
 */
import {
  readMemoryPressure,
  type MemoryPressure,
} from "@/lib/composer-memory-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { isIosAppBootQuiet } from "@/lib/ios-app-boot";
import { isIosReloadMinimalMode } from "@/lib/ios-reload-guard";
import {
  estimateOomRisk,
  oomRiskToMemoryPressure,
  shouldDisableTimelineThumbsForOomRisk,
} from "@/lib/ios-memory-heuristics";
import { releaseAllTimelineThumbUrls } from "@/lib/timeline-thumb-cache";

export type { MemoryPressure };

export function readTimelineMemoryPressure(): MemoryPressure {
  if (isIosWebKit()) {
    const pressure = oomRiskToMemoryPressure(estimateOomRisk());
    if (pressure === "critical") {
      releaseAllTimelineThumbUrls();
    }
    return pressure;
  }
  return readMemoryPressure(0);
}

/** Text-first list when OOM risk is medium/high (iOS) or heap is critical. */
export function shouldUseTextFirstTimeline(pressure: MemoryPressure): boolean {
  if (isIosReloadMinimalMode()) return true;
  if (isIosAppBootQuiet()) return true;
  if (shouldDisableTimelineThumbsForOomRisk()) return true;
  return pressure === "critical";
}

/** Block thumb decode during sync/scroll when OOM risk is elevated. */
export function shouldBlockTimelineThumbs(pressure: MemoryPressure): boolean {
  if (shouldDisableTimelineThumbsForOomRisk()) return true;
  return pressure === "critical";
}

export function isTimelineMemoryGuardActive(): boolean {
  return isIosWebKit();
}
