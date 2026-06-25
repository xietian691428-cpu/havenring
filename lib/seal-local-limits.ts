/** Local-first storage ceilings (relay + IDB persist) — not cloud staging caps. */

/** Cross-tab seal relay (localStorage / sessionStorage). */
export const SEAL_LOCAL_RELAY_MAX_BYTES = 200 * 1024 * 1024;

/** Client local persist / composer handoff budget (IndexedDB). */
export const SEAL_LOCAL_PERSIST_MAX_BYTES = 200 * 1024 * 1024;
