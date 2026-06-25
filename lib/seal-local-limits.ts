/** Local-first storage ceilings (relay + IDB persist) — not cloud staging caps. */

import {
  SEAL_LOCAL_PERSIST_DEFAULT_BYTES,
  resolveLocalPersistMaxBytes,
} from "@/lib/storage-quota";

/** Cross-tab seal relay (localStorage / sessionStorage). */
export const SEAL_LOCAL_RELAY_MAX_BYTES = SEAL_LOCAL_PERSIST_DEFAULT_BYTES;

/** Client local persist / composer handoff budget (IndexedDB). */
export const SEAL_LOCAL_PERSIST_MAX_BYTES = SEAL_LOCAL_PERSIST_DEFAULT_BYTES;

export { resolveLocalPersistMaxBytes };
