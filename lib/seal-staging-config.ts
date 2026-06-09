/** Seal staging limits and feature flags (server + public client). */

/** Max encrypted payload per seal staging upload (2 MB). */
export const SEAL_STAGING_MAX_BYTES = 2 * 1024 * 1024;

/** Inline DB storage below this size; larger blobs go to Supabase Storage. */
export const SEAL_STAGING_DB_INLINE_MAX_BYTES = 256 * 1024;

export const SEAL_STAGING_BUCKET = "seal-staging";

export const SEAL_STAGING_SIGNED_URL_TTL_SEC = 120;

function readEnvFlag(name: string, fallback = true): boolean {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

/** Master kill switch for staging API (server). */
export function isSealStagingApiEnabled(): boolean {
  return readEnvFlag("SEAL_STAGING_ENABLED", true);
}

/** Client-visible staging enable (build-time). */
export function isSealStagingClientEnabled(): boolean {
  return readEnvFlag("NEXT_PUBLIC_SEAL_STAGING_ENABLED", true);
}

/** Android / desktop fallback upload when local IDB misses (server). */
export function isSealStagingFallbackEnabled(): boolean {
  return (
    isSealStagingApiEnabled() &&
    readEnvFlag("SEAL_STAGING_FALLBACK_ENABLED", true)
  );
}

/** Client-visible fallback flag. */
export function isSealStagingFallbackClientEnabled(): boolean {
  return (
    isSealStagingClientEnabled() &&
    readEnvFlag("NEXT_PUBLIC_SEAL_STAGING_FALLBACK_ENABLED", true)
  );
}
