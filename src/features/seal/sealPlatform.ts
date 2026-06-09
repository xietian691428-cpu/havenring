import type { HavenPlatform } from "../../content/havenCopy";
import { isStandaloneDisplayMode } from "../../hooks/usePlatform";
import { resolvePlatformTarget } from "../../hooks/usePlatformTarget";
import { isEphemeralStorageEnvironment } from "./ephemeralStorage";

export type SealTransportMode = "staging" | "local";

/**
 * iOS ring taps open a sibling tab — staging is required.
 * Android prefers same-tab Web NFC + local IDB; staging on ephemeral or fallback.
 */
export function resolveSealTransportMode(
  platform: HavenPlatform = resolvePlatformTarget(),
  opts: { forceStaging?: boolean } = {}
): SealTransportMode {
  if (opts.forceStaging) return "staging";
  if (isStandaloneDisplayMode() && !isEphemeralStorageEnvironment()) {
    return "local";
  }
  if (platform === "ios") return "staging";
  if (isEphemeralStorageEnvironment()) return "staging";
  return "local";
}

export function shouldPreferSameTabWebNfc(platform: HavenPlatform = resolvePlatformTarget()): boolean {
  return platform === "android";
}
