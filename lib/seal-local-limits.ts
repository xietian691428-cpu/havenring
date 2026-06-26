/** Local-first storage ceilings (relay + IDB persist) — not cloud staging caps. */

import {
  SEAL_LOCAL_PERSIST_DEFAULT_BYTES,
  resolveLocalPersistMaxBytes,
} from "@/lib/storage-quota";

/** Cross-tab seal relay (localStorage / sessionStorage). */
export const SEAL_LOCAL_RELAY_MAX_BYTES = SEAL_LOCAL_PERSIST_DEFAULT_BYTES;

/** Client local persist / composer handoff budget (IndexedDB) — image-only memories. */
export const SEAL_LOCAL_PERSIST_MAX_BYTES = SEAL_LOCAL_PERSIST_DEFAULT_BYTES;

/** Single video clip ceiling — conservative until iOS path is stable. */
export const MAX_VIDEO_ATTACHMENT_BYTES = 80 * 1024 * 1024;

/** Whole memory cap when any video is attached (video + images + text). */
export const MAX_MEMORY_WITH_VIDEO_BYTES = 150 * 1024 * 1024;

/** Warn / prefer light seal when device headroom below this. */
export const VIDEO_HEADROOM_WARN_BYTES = 120 * 1024 * 1024;

/** Light duration guard — no transcoding. */
export const MAX_VIDEO_DURATION_SEC = 120;

export const MAX_VIDEO_ATTACHMENT_MB = Math.floor(
  MAX_VIDEO_ATTACHMENT_BYTES / (1024 * 1024)
);
export const MAX_MEMORY_WITH_VIDEO_MB = Math.floor(
  MAX_MEMORY_WITH_VIDEO_BYTES / (1024 * 1024)
);
export const VIDEO_HEADROOM_WARN_MB = Math.floor(
  VIDEO_HEADROOM_WARN_BYTES / (1024 * 1024)
);

export { resolveLocalPersistMaxBytes };
