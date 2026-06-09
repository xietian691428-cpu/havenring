import type { HavenPlatform } from "../../content/havenCopy";
import { isStandaloneDisplayMode } from "../../hooks/usePlatform";
import { resolvePlatformTarget } from "../../hooks/usePlatformTarget";
import {
  isSealStagingClientEnabled,
  isSealStagingFallbackClientEnabled,
} from "@/lib/seal-staging-config";
import { isEphemeralStorageEnvironment } from "./ephemeralStorage";

export type SealTransportMode = "staging" | "local";

export type SealStrategy = {
  transport: SealTransportMode;
  /** Android same-tab Web NFC when true. */
  preferSameTabWebNfc: boolean;
  /** Upload encrypted blob before ring tap (iOS / ephemeral). */
  stagingOnPrep: boolean;
  /** Upload during finalize when local IDB missed (Android / PWA). */
  stagingFallbackOnFinalize: boolean;
  stagingApiEnabled: boolean;
};

/**
 * Single decision point for seal transport — platform, PWA, ephemeral, feature flags.
 * iOS browser → staging on prep. Android + PWA → local first; staging only on fallback.
 */
export function getSealStrategy(
  platform: HavenPlatform = resolvePlatformTarget(),
  opts: { forceStaging?: boolean } = {}
): SealStrategy {
  const stagingApiEnabled = isSealStagingClientEnabled();
  const stagingFallbackEnabled = isSealStagingFallbackClientEnabled();
  const ephemeral = isEphemeralStorageEnvironment();
  const standalone = isStandaloneDisplayMode() && !ephemeral;

  if (opts.forceStaging || ephemeral) {
    return {
      transport: "staging",
      preferSameTabWebNfc: false,
      stagingOnPrep: true,
      stagingFallbackOnFinalize: false,
      stagingApiEnabled,
    };
  }

  if (platform === "ios") {
    return {
      transport: "staging",
      preferSameTabWebNfc: false,
      stagingOnPrep: true,
      stagingFallbackOnFinalize: false,
      stagingApiEnabled,
    };
  }

  if (standalone) {
    return {
      transport: "local",
      preferSameTabWebNfc: false,
      stagingOnPrep: false,
      stagingFallbackOnFinalize: stagingFallbackEnabled,
      stagingApiEnabled,
    };
  }

  return {
    transport: "local",
    preferSameTabWebNfc: platform === "android",
    stagingOnPrep: false,
    stagingFallbackOnFinalize: stagingFallbackEnabled,
    stagingApiEnabled,
  };
}

/** @deprecated Prefer `getSealStrategy().transport`. */
export function resolveSealTransportMode(
  platform: HavenPlatform = resolvePlatformTarget(),
  opts: { forceStaging?: boolean } = {}
): SealTransportMode {
  return getSealStrategy(platform, opts).transport;
}

export function shouldPreferSameTabWebNfc(
  platform: HavenPlatform = resolvePlatformTarget()
): boolean {
  return getSealStrategy(platform).preferSameTabWebNfc;
}
