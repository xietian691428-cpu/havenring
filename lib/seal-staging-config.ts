/** Seal staging limits and feature flags (server + public client). */

/** Max encrypted staging blob (cross-tab handoff, iOS). */
export const SEAL_STAGING_MAX_BYTES = 20 * 1024 * 1024;

/** Plus users — larger ephemeral staging for cloud handoff. */
export const SEAL_STAGING_PLUS_MAX_BYTES = 100 * 1024 * 1024;

/** Local finalize / IDB target (client keeps full media here). */
export const SEAL_LOCAL_MAX_BYTES = 50 * 1024 * 1024;

/** Inline DB storage below this size; larger blobs go to Supabase Storage. */
export const SEAL_STAGING_DB_INLINE_MAX_BYTES = 1024 * 1024;

/** Chunk size for resumable Plus cloud / staging uploads. */
export const SEAL_CLOUD_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

/** Max single POST body for staging create (Vercel serverless ~4.5MB). */
export const SEAL_STAGING_INLINE_POST_MAX_BYTES = 3 * 1024 * 1024;

/** Chunk size for encrypted staging upload requests. */
export const SEAL_STAGING_CHUNK_BYTES = 3 * 1024 * 1024;

/** JSON plaintext budget before encrypt (fits ciphertext cap after AES-GCM + base64). */
export const SEAL_STAGING_PLAINTEXT_RATIO = 0.68;

export function resolveSealStagingPlaintextMaxBytes(isPlus: boolean): number {
  return Math.floor(resolveSealStagingMaxBytes(isPlus) * SEAL_STAGING_PLAINTEXT_RATIO);
}

export const SEAL_STAGING_BUCKET = "seal-staging";

export const SEAL_STAGING_SIGNED_URL_TTL_SEC = 120;

export function resolveSealStagingMaxBytes(isPlus: boolean): number {
  return isPlus ? SEAL_STAGING_PLUS_MAX_BYTES : SEAL_STAGING_MAX_BYTES;
}

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
