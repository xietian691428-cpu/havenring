import { isIosWebKit } from "@/lib/composer-platform-limits";

type DeferOpts = {
  timeout?: number;
};

/** True on iOS WebKit or devices reporting ≤4GB RAM. */
export function isLowMemoryEntryDevice(): boolean {
  if (isIosWebKit()) return true;
  if (typeof navigator === "undefined") return false;
  const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof dm === "number" && dm > 0 && dm <= 4;
}

/** Defer non-critical entry work until after first paint (iOS-safe). */
export function deferEntryWork(fn: () => void, opts: DeferOpts = {}): void {
  if (typeof window === "undefined") return;
  const timeout = opts.timeout ?? (isLowMemoryEntryDevice() ? 1400 : 450);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(fn, { timeout });
    return;
  }
  window.setTimeout(fn, Math.min(timeout, 600));
}

export function deferEntryWorkAsync<T>(
  fn: () => Promise<T>,
  opts: DeferOpts = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    deferEntryWork(() => {
      void fn().then(resolve, reject);
    }, opts);
  });
}
