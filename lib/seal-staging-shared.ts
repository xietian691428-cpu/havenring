import { createHash } from "crypto";
import { MAX_SEAL_DRAFT_IDS } from "./seal-shared";

/** Ephemeral seal buffer TTL — align with product (10 minutes). */
export const SEAL_STAGING_TTL_MS = 10 * 60 * 1000;

import {
  SEAL_LOCAL_MAX_BYTES,
  SEAL_STAGING_MAX_BYTES,
  SEAL_STAGING_PLUS_MAX_BYTES,
  resolveSealStagingMaxBytes,
} from "./seal-staging-config";

export {
  SEAL_LOCAL_MAX_BYTES,
  SEAL_STAGING_MAX_BYTES,
  SEAL_STAGING_PLUS_MAX_BYTES,
  resolveSealStagingMaxBytes,
};

/** Encrypted staging upload ceiling (matches SEAL_STAGING_MAX_BYTES by default). */
export const SEAL_STAGING_MAX_CIPHERTEXT_BYTES = SEAL_STAGING_MAX_BYTES;

export const SEAL_STAGING_HKDF_SALT = "haven-seal-staging-v1";
export const SEAL_STAGING_HKDF_INFO = "seal-staging-dek";

export function sealStagingExpiryIso(fromMs = Date.now()): string {
  return new Date(fromMs + SEAL_STAGING_TTL_MS).toISOString();
}

export function hashSealStagingContent(ciphertext: string): string {
  return createHash("sha256").update(ciphertext).digest("hex");
}

export function parseSealStagingDraftIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => String(row || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SEAL_DRAFT_IDS);
}
