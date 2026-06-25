export type BackgroundSyncStatusCopy = {
  backgroundSyncPendingOne: string;
  backgroundSyncPendingMany: string;
  backgroundSyncOffline: string;
};

/** Settings status line for pending seal finalize queue (≤1 sentence). */
export function formatBackgroundSyncStatusLine(
  opts: { pending: number; online: boolean },
  copy: BackgroundSyncStatusCopy
): string {
  const n = Number(opts.pending || 0);
  if (!n) return "";
  if (!opts.online) return copy.backgroundSyncOffline;
  return n === 1
    ? copy.backgroundSyncPendingOne
    : copy.backgroundSyncPendingMany.replace("{n}", String(n));
}
