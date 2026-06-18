import { isLowMemoryEntryDevice } from "@/lib/entry-defer";
import { getOomRiskSyncDelayMs } from "@/lib/ios-memory-heuristics";

const BOOT_SESSION_KEY = "haven.ios.boot.v1";

type BootMarker = { at: number };

export type IosSyncTrigger = "mount-sync" | "visibility" | "session" | "retry";

/** Ms after /app paint before background sync is allowed (iOS). */
export const IOS_BOOT_SYNC_DELAY_MS = 10_000;

function iosSyncMinAge(trigger: IosSyncTrigger): number {
  switch (trigger) {
    case "mount-sync":
      return IOS_BOOT_SYNC_DELAY_MS;
    case "visibility":
      return IOS_VISIBILITY_SYNC_MIN_AGE_MS;
    case "session":
      return IOS_SESSION_SYNC_MIN_AGE_MS;
    case "retry":
      return IOS_BOOT_SYNC_DELAY_MS;
    default:
      return IOS_BOOT_SYNC_DELAY_MS;
  }
}

/** Gate automatic background sync during the iOS boot window. */
export function shouldRunIosBackgroundSync(trigger: IosSyncTrigger): boolean {
  if (!isLowMemoryEntryDevice()) return true;
  return getIosAppBootAgeMs() >= getOomRiskSyncDelayMs(iosSyncMinAge(trigger));
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

export function markIosAppBootStarted(): void {
  if (!isLowMemoryEntryDevice()) return;
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(BOOT_SESSION_KEY, JSON.stringify({ at: Date.now() } satisfies BootMarker));
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

/** Ms before first timeline refresh on iOS. */
export const IOS_BOOT_REFRESH_DELAY_MS = 4_500;

/** Ms before visibility-triggered sync on iOS. */
const IOS_VISIBILITY_SYNC_MIN_AGE_MS = 18_000;

/** Ms before session-login background sync on iOS. */
const IOS_SESSION_SYNC_MIN_AGE_MS = 8_000;

/** Quiet period after /app client navigation (sync banner, etc.). */
export const IOS_BOOT_QUIET_MS = 14_000;

/** Min ms after /app boot before pull-to-refresh is allowed (iOS). */
export const IOS_PULL_REFRESH_MIN_BOOT_MS = 20_000;

export function shouldAllowTimelinePullRefresh(): boolean {
  if (!isLowMemoryEntryDevice()) return true;
  return getIosAppBootAgeMs() >= IOS_PULL_REFRESH_MIN_BOOT_MS;
}

/** Strip `?from=start` after SPA entry; returns whether the marker was present. */
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
