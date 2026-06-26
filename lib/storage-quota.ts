/** Device storage estimates for local-first persist budgets. */

export const LOCAL_STORAGE_TIGHT_RATIO = 0.85;

/** Default local persist / relay ceiling when quota is unknown. */
export const SEAL_LOCAL_PERSIST_DEFAULT_BYTES = 500 * 1024 * 1024;

export type StorageEstimateSnapshot = {
  usage: number;
  quota: number;
  headroom: number;
  usageRatio: number;
};

export async function readStorageEstimate(): Promise<StorageEstimateSnapshot | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    const usage = Number(est.usage || 0);
    const quota = Number(est.quota || 0);
    if (!quota) return null;
    const headroom = Math.max(0, quota - usage);
    const usageRatio = usage / quota;
    return { usage, quota, headroom, usageRatio };
  } catch {
    return null;
  }
}

/** Local persist budget — min(500MB product cap, ~90% of remaining device quota). */
export async function resolveLocalPersistMaxBytes(): Promise<number> {
  const est = await readStorageEstimate();
  if (!est) return SEAL_LOCAL_PERSIST_DEFAULT_BYTES;
  const fromHeadroom = Math.floor(est.headroom * 0.9);
  if (fromHeadroom <= 0) return 0;
  return Math.min(SEAL_LOCAL_PERSIST_DEFAULT_BYTES, fromHeadroom);
}

export async function isDeviceStorageCriticallyLow(): Promise<boolean> {
  const est = await readStorageEstimate();
  return est != null && est.usageRatio >= LOCAL_STORAGE_TIGHT_RATIO;
}

export function logStorageEstimate(context: string): void {
  if (typeof console === "undefined") return;
  void readStorageEstimate().then((est) => {
    if (!est) return;
    console.log(`[haven-ring] storage estimate (${context})`, {
      usageMb: Math.round(est.usage / (1024 * 1024)),
      quotaMb: Math.round(est.quota / (1024 * 1024)),
      headroomMb: Math.round(est.headroom / (1024 * 1024)),
      usageRatio: Math.round(est.usageRatio * 1000) / 1000,
      tight: est.usageRatio >= LOCAL_STORAGE_TIGHT_RATIO,
    });
  });
}
