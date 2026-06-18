import { isLowMemoryEntryDevice } from "@/lib/entry-defer";

const BOOT_SESSION_KEY = "haven.ios.boot.v1";

type BootMarker = { at: number; fromStart: boolean };

export type IosSyncTrigger = "mount-sync" | "visibility" | "session" | "retry";

/** Ms after /app paint before background sync is allowed (iOS). */
export const IOS_BOOT_SYNC_DELAY_MS = 10_000;

/** Extra quiet time when entering from /start Open App. */
const IOS_FROM_START_EXTRA_MS = 5_000;

function iosSyncMinAge(trigger: IosSyncTrigger): number {
  const extra = readIosBootFromStart() ? IOS_FROM_START_EXTRA_MS : 0;
  switch (trigger) {
    case "mount-sync":
      return IOS_BOOT_SYNC_DELAY_MS + extra;
    case "visibility":
      return IOS_VISIBILITY_SYNC_MIN_AGE_MS + extra;
    case "session":
      return IOS_SESSION_SYNC_MIN_AGE_MS + extra;
    case "retry":
      return IOS_BOOT_SYNC_DELAY_MS + extra;
    default:
      return IOS_BOOT_SYNC_DELAY_MS + extra;
  }
}

/** Gate automatic background sync during the iOS boot window. */
export function shouldRunIosBackgroundSync(trigger: IosSyncTrigger): boolean {
  if (!isLowMemoryEntryDevice()) return true;
  return getIosAppBootAgeMs() >= iosSyncMinAge(trigger);
}

function readBootMarker(): BootMarker | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(BOOT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BootMarker;
    if (!parsed?.at || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function markIosAppBootStarted(opts: { fromStart?: boolean } = {}): void {
  if (!isLowMemoryEntryDevice()) return;
  if (typeof sessionStorage === "undefined") return;
  try {
    const prev = readBootMarker();
    const fromStart = Boolean(opts.fromStart) || Boolean(prev?.fromStart);
    sessionStorage.setItem(
      BOOT_SESSION_KEY,
      JSON.stringify({ at: Date.now(), fromStart } satisfies BootMarker)
    );
  } catch {
    /* quota */
  }
}

export function getIosAppBootAgeMs(): number {
  const marker = readBootMarker();
  if (!marker) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - marker.at);
}

export function isIosAppBootQuiet(): boolean {
  if (!isLowMemoryEntryDevice()) return false;
  return getIosAppBootAgeMs() < IOS_BOOT_QUIET_MS;
}

export function readIosBootFromStart(): boolean {
  return Boolean(readBootMarker()?.fromStart);
}

/** Ms before first timeline refresh on iOS. */
export const IOS_BOOT_REFRESH_DELAY_MS = 4_500;

/** Ms before visibility-triggered sync on iOS. */
const IOS_VISIBILITY_SYNC_MIN_AGE_MS = 18_000;

/** Ms before session-login background sync on iOS. */
const IOS_SESSION_SYNC_MIN_AGE_MS = 8_000;

/** Quiet period: text-first timeline + no thumb decode. */
export const IOS_BOOT_QUIET_MS = 14_000;

export function consumeIosBootFromStartQuery(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get("from") !== "start") return false;
    u.searchParams.delete("from");
    const next = `${u.pathname}${u.search}${u.hash}`.replace(/\?$/, "");
    window.history.replaceState({}, "", next || u.pathname);
    return true;
  } catch {
    return false;
  }
}
