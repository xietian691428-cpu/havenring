import { useMemo } from "react";
import { detectPlatform } from "./usePlatform";

/**
 * Strict platform for UI copy (iOS / Android / other). Does not remap desktop to iOS.
 */
export function resolvePlatformTarget() {
  return detectPlatform();
}

export function usePlatformTarget() {
  return useMemo(() => resolvePlatformTarget(), []);
}
