import { deferEntryWork, isLowMemoryEntryDevice } from "@/lib/entry-defer";
import { getOomRiskSyncDelayMs, shouldDisableTimelineThumbsForOomRisk } from "@/lib/ios-memory-heuristics";
import { isIosReloadMinimalMode } from "@/lib/ios-reload-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { isPostSealQuietWindow } from "@/lib/post-seal-memory-guard";

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

/** Min ms before timeline thumb decode (iOS). */
export const IOS_THUMB_MIN_BOOT_MS = 10_000;

/** After seal, keep timeline text-only for this long (iOS memory). */
export const IOS_SEAL_THUMB_QUIET_MS = 10_000;

/** Min ms before legacy inline-photo migration (iOS). */
export const IOS_LEGACY_MIGRATION_MIN_BOOT_MS = 12_000;

/** Min ms before background cloud restore (iOS). */
export const IOS_CLOUD_RESTORE_MIN_BOOT_MS = 16_000;

/** Min ms before pull-refresh may run a full pair re-import (iOS). */
export const IOS_FULL_PAIR_SYNC_MIN_BOOT_MS = 45_000;

let iosTimelineScrolled = false;
const iosTimelineScrollListeners = new Set<() => void>();

/** First scroll on timeline unlocks thumb decode (iOS). */
export function markIosTimelineScrolled(): void {
  if (!isIosWebKit() || iosTimelineScrolled) return;
  iosTimelineScrolled = true;
  for (const listener of iosTimelineScrollListeners) {
    listener();
  }
}

export function hasIosTimelineScrolled(): boolean {
  return iosTimelineScrolled;
}

export function subscribeIosTimelineScroll(listener: () => void): () => void {
  iosTimelineScrollListeners.add(listener);
  return () => {
    iosTimelineScrollListeners.delete(listener);
  };
}

export function shouldAllowTimelinePullRefresh(): boolean {
  if (!isLowMemoryEntryDevice()) return true;
  return getIosAppBootAgeMs() >= IOS_PULL_REFRESH_MIN_BOOT_MS;
}

export function shouldAllowIosTimelineThumbs(): boolean {
  if (!isIosWebKit()) return true;
  if (isIosReloadMinimalMode()) return false;
  if (isPostSealQuietWindow()) return false;
  if (shouldDisableTimelineThumbsForOomRisk()) return false;
  return true;
}

export function shouldAllowIosLegacyMigration(): boolean {
  if (!isIosWebKit()) return true;
  return getIosAppBootAgeMs() >= getOomRiskSyncDelayMs(IOS_LEGACY_MIGRATION_MIN_BOOT_MS);
}

export function shouldAllowIosCloudRestore(): boolean {
  if (!isIosWebKit()) return true;
  return getIosAppBootAgeMs() >= getOomRiskSyncDelayMs(IOS_CLOUD_RESTORE_MIN_BOOT_MS);
}

/** Full pair bundle re-import is heavy — only after boot settles on iOS. */
export function shouldAllowIosFullPairSync(): boolean {
  if (!isIosWebKit()) return true;
  return getIosAppBootAgeMs() >= getOomRiskSyncDelayMs(IOS_FULL_PAIR_SYNC_MIN_BOOT_MS);
}

/** Defer work until iOS boot quiet window passes (no-op on other platforms). */
export function deferIosPostBootWork(
  fn: () => void,
  minBootMs: number,
  opts: { timeout?: number } = {}
): void {
  if (!isIosWebKit()) {
    fn();
    return;
  }
  const required = getOomRiskSyncDelayMs(minBootMs);
  const age = getIosAppBootAgeMs();
  const wait = Math.max(0, required - age);
  deferEntryWork(fn, { timeout: opts.timeout ?? wait + 400 });
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
