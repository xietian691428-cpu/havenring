/**
 * Best-effort persistent storage (survives low-disk eviction better on some browsers).
 * Call only from a user gesture (tap, verified export, ring finalize).
 */
export function requestStoragePersistenceFromUserGesture(): void {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
  void navigator.storage.persist().catch(() => {
    /* ignore */
  });
}
