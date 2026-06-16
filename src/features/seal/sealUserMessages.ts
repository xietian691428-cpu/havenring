/** User-visible seal copy — one short sentence each. */

import {
  SEAL_LOCAL_MAX_BYTES,
  resolveSealStagingMaxBytes,
} from "@/lib/seal-staging-shared";

export const SEAL_STAGING_OFFLINE =
  "Saved on this device — we'll sync when you're back online.";

/** Sentinel — UI maps to localized copy with `{mb}` limit. */
export const SEAL_STAGING_TOO_LARGE = "SEAL_STAGING_TOO_LARGE";

export type SealStagingTooLargeError = Error & { limitMb: number };

export function sealStagingLimitMb(
  isPlus: boolean,
  forStaging = true
): number {
  const bytes = forStaging
    ? resolveSealStagingMaxBytes(isPlus)
    : SEAL_LOCAL_MAX_BYTES;
  return Math.floor(bytes / (1024 * 1024));
}

export function formatSealStagingTooLargeEn(limitMb: number): string {
  return `This memory is too large to seal (limit: ${limitMb} MB). Remove a video, file, or some photos to shrink it, then try again.`;
}

export function isSealStagingTooLargeError(
  error: unknown
): error is SealStagingTooLargeError {
  return (
    error instanceof Error &&
    error.message === SEAL_STAGING_TOO_LARGE &&
    typeof (error as SealStagingTooLargeError).limitMb === "number"
  );
}

export function throwSealStagingTooLarge(
  isPlus: boolean,
  forStaging = true
): never {
  const err = new Error(SEAL_STAGING_TOO_LARGE) as SealStagingTooLargeError;
  err.limitMb = sealStagingLimitMb(isPlus, forStaging);
  throw err;
}

export const SEAL_STAGING_UNAVAILABLE =
  "Sealing is briefly unavailable — try again in a moment.";

export const SEAL_DRAFT_NOT_FOUND = "Hold your ring near your phone once more.";

export const SEAL_SESSION_ENDED = "Hold your ring near your phone once more.";

export const SEAL_RETRY_RING = "Hold your ring near your phone once more.";

export const SEAL_PWA_HINT =
  "For the most reliable experience, add Haven to your Home Screen.";
