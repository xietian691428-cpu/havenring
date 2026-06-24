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

export function shouldAllowTimelineRefresh(opts: { force?: boolean } = {}): boolean {
  if (opts.force) return true;
  const last = readLastRefreshAt();
  if (!last) return true;
  return Date.now() - last >= TIMELINE_REFRESH_COOLDOWN_MS;
}
