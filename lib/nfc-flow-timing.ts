export const NFC_FLOW_TIMING = {
  /** Keep "Reading…" visible long enough to read. */
  minResolvingMs: 2500,
  /** Show failure guidance before offering Retry. */
  minFailedBeforeRetryMs: 8000,
  /** Let success copy land before redirect. */
  successRedirectMs: 2000,
  /** Client-side cap so iOS Safari does not sit on "Still reading…" forever. */
  sdmResolveFetchTimeoutMs: 22_000,
  /** Auth/session prep during NFC resolve. */
  sdmResolveAuthTimeoutMs: 8_000,
  /** Foreground NFC tab may retry lock acquisition before failing. */
  sealLockRetryMs: 12_000,
  /** Hard watchdog — force failed UI if resolve never finishes. */
  sdmResolveWatchdogMs: 35_000,
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

/** Reject when `promise` does not settle within `ms` (iOS Safari auth/session stalls). */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Request timed out."
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Whole seconds left until `endsAt`, for on-page countdowns synced with internal timers. */
export function visibleSecondsRemaining(endsAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
