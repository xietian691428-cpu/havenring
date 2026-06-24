import { STORAGE_KEYS } from "@/lib/storage-keys";

/** Min ms between automatic timeline refreshes (tab spam / mount overlap). */
export const TIMELINE_REFRESH_COOLDOWN_MS = 3_000;

/** Skip mount refresh when tab navigation claimed refresh within this window. */
export const TIMELINE_TAB_MOUNT_SKIP_MS = 8_000;

let tabRefreshClaimedAt = 0;

export function markTabTimelineRefreshClaimed(): void {
  tabRefreshClaimedAt = Date.now();
}

export function shouldSkipMountTimelineRefresh(): boolean {
  if (!tabRefreshClaimedAt) return false;
  return Date.now() - tabRefreshClaimedAt < TIMELINE_TAB_MOUNT_SKIP_MS;
}

function readSessionFlag(key: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* quota */
  }
}

/** First automatic mount refresh only — prevents re-entry refresh loops on iOS. */
export function claimBootTimelineRefresh(): boolean {
  if (readSessionFlag(STORAGE_KEYS.timelineBootRefresh)) return false;
  writeSessionFlag(STORAGE_KEYS.timelineBootRefresh);
  return true;
}

/** First automatic background sync only — merges session + mount-sync triggers. */
export function claimBootBackgroundSync(): boolean {
  if (readSessionFlag(STORAGE_KEYS.timelineBootSync)) return false;
  writeSessionFlag(STORAGE_KEYS.timelineBootSync);
  return true;
}

function readLastRefreshAt(): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.timelineLastRefresh);
    if (!raw) return 0;
    const at = Number(raw);
    return Number.isFinite(at) ? at : 0;
  } catch {
    return 0;
  }
}

export function markTimelineRefreshCompleted(): void {
  const at = Date.now();
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.timelineLastRefresh, String(at));
  } catch {
    /* quota */
  }
}

export function getTimelineRefreshAgeMs(): number {
  const last = readLastRefreshAt();
  if (!last) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - last);
}

export function shouldAllowTimelineRefresh(opts: { force?: boolean } = {}): boolean {
  if (opts.force) return true;
  const last = readLastRefreshAt();
  if (!last) return true;
  return Date.now() - last >= TIMELINE_REFRESH_COOLDOWN_MS;
}
