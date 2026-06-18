/**
 * Timeline memory pressure — iOS heuristics + composer pressure fallback.
 */
import {
  readMemoryPressure,
  type MemoryPressure,
} from "@/lib/composer-memory-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import {
  estimateOomRisk,
  oomRiskToMemoryPressure,
  shouldDisableTimelineThumbsForOomRisk,
} from "@/lib/ios-memory-heuristics";

export type { MemoryPressure };

export function readTimelineMemoryPressure(): MemoryPressure {
  if (isIosWebKit()) {
    return oomRiskToMemoryPressure(estimateOomRisk());
  }
  return readMemoryPressure(0);
}

/** Text-first list when OOM risk is medium/high (iOS) or heap is critical. */
export function shouldUseTextFirstTimeline(pressure: MemoryPressure): boolean {
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
