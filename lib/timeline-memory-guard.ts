/**
 * Timeline memory pressure — iOS heuristics + composer pressure fallback.
 */
import {
  readMemoryPressure,
  type MemoryPressure,
} from "@/lib/composer-memory-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { isIosReloadMinimalMode } from "@/lib/ios-reload-guard";
import {
  estimateOomRisk,
  oomRiskToMemoryPressure,
  shouldDisableTimelineThumbsForOomRisk,
  type OomRiskLevel,
} from "@/lib/ios-memory-heuristics";
import { isPostSealQuietWindow } from "@/lib/post-seal-memory-guard";
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

/** Text-first only during post-seal quiet, reload recovery, or critical OOM. */
export function shouldUseTextFirstTimeline(pressure: MemoryPressure): boolean {
  if (isIosReloadMinimalMode()) return true;
  if (isPostSealQuietWindow()) return true;
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
