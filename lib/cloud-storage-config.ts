import { PLUS_STORAGE_GB } from "./subscription";
import { SEAL_CLOUD_UPLOAD_CHUNK_BYTES } from "./seal-staging-config";

/** Hard Plus cloud backup quota (50 GB). */
export const CLOUD_STORAGE_QUOTA_GB = PLUS_STORAGE_GB;
export const CLOUD_STORAGE_QUOTA_BYTES =
  CLOUD_STORAGE_QUOTA_GB * 1024 * 1024 * 1024;

/** Chunk size for resumable cloud uploads (8 MB). */
export const CLOUD_UPLOAD_CHUNK_BYTES = SEAL_CLOUD_UPLOAD_CHUNK_BYTES;

export const CLOUD_BACKUP_BUCKET = "cloud-backup";

export const CLOUD_STORAGE_FULL_CODE = "CLOUD_STORAGE_FULL";

/** User-visible when quota exceeded (≤1 sentence). */
export const CLOUD_STORAGE_FULL_MESSAGE =
  "Storage full. Upgrade or delete old memories.";
