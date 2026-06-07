export const NFC_FLOW_TIMING = {
  /** Keep "Reading…" visible long enough to read. */
  minResolvingMs: 2500,
  /** Show failure guidance before offering Retry. */
  minFailedBeforeRetryMs: 8000,
  /** Let success copy land before redirect. */
  successRedirectMs: 2000,
} as const;

export const RING_WAIT_QUERY = "ring_wait";
export const RING_WAIT_REASON_KEY = "haven.ring_wait_reason.v1";

export type RingWaitReason = "fresh" | "retry" | "replay";

export function isRingWaitSearch(search = ""): boolean {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get(RING_WAIT_QUERY) === "1";
}

export function readRingWaitReason(): RingWaitReason {
  if (typeof window === "undefined") return "fresh";
  try {
    const raw = window.sessionStorage.getItem(RING_WAIT_REASON_KEY);
    if (raw === "retry" || raw === "replay" || raw === "fresh") return raw;
  } catch {
    /* ignore */
  }
  return "fresh";
}

export function writeRingWaitReason(reason: RingWaitReason) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RING_WAIT_REASON_KEY, reason);
  } catch {
    /* ignore */
  }
}

export function clearRingWaitReason() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RING_WAIT_REASON_KEY);
  } catch {
    /* ignore */
  }
}

export function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
