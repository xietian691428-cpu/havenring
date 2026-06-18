/**
 * Timeline memory pressure — thin wrapper for iOS text-first degradation.
 */
import {
  readMemoryPressure,
  type MemoryPressure,
} from "@/lib/composer-memory-guard";
import { isIosAppBootQuiet } from "@/lib/ios-app-boot";
import { isIosWebKit } from "@/lib/composer-platform-limits";

export type { MemoryPressure };

export function readTimelineMemoryPressure(): MemoryPressure {
  return readMemoryPressure(0);
}

/** Hide timeline thumbnails; show title + story preview only. */
export function shouldUseTextFirstTimeline(pressure: MemoryPressure): boolean {
  if (isIosAppBootQuiet()) return true;
  if (!isIosWebKit()) return pressure === "critical";
  return pressure === "elevated" || pressure === "critical";
}

/** Block all thumb decode work (sync/scroll). */
export function shouldBlockTimelineThumbs(pressure: MemoryPressure): boolean {
  return pressure === "critical";
}

export function isTimelineMemoryGuardActive(): boolean {
  return isIosWebKit();
}
