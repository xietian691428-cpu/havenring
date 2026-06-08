export const NFC_FLOW_TIMING = {
  /** Keep "Reading…" visible long enough to read. */
  minResolvingMs: 2500,
  /** Show failure guidance before offering Retry. */
  minFailedBeforeRetryMs: 8000,
  /** Let success copy land before redirect. */
  successRedirectMs: 2000,
} as const;

/** Timers for other user-action steps (NFC listen, claim, bind, hub, sync). */
export const ACTION_STEP_TIMING = {
  ...NFC_FLOW_TIMING,
  nfcScanListenMs: 12_000,
  claimTimeoutMs: 12_000,
  claimSuccessRedirectMs: 1200,
  bindSuccessRedirectMs: 400,
  bindOperationMs: 15_000,
  hubReadingMinMs: 2500,
  authCheckHintMs: 8000,
  /** When to switch from primary status to "Still …" without showing seconds. */
  slowStatusHintMs: 3000,
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

/** Whole seconds left until `endsAt`, for on-page countdowns synced with internal timers. */
export function visibleSecondsRemaining(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
