import {
  estimateOomRisk,
  getTotalMemoryCount,
  oomRiskToMemoryPressure,
  type OomRiskLevel,
} from "@/lib/ios-memory-heuristics";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const POST_SEAL_QUIET_MS = 45_000;
export const POST_SEAL_VIDEO_QUIET_MS = 90_000;

type PostSealMarker = {
  at: number;
  hasLargeMedia?: boolean;
  hasVideo?: boolean;
  /** Draft ids for the seal that just completed — background worker prioritizes these. */
  priorityDraftIds?: string[];
};

function resolveQuietMs(marker: PostSealMarker | null): number {
  if (!marker) return POST_SEAL_QUIET_MS;
  return marker.hasVideo ? POST_SEAL_VIDEO_QUIET_MS : POST_SEAL_QUIET_MS;
}

function readMarker(): PostSealMarker | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.postSealQuiet);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostSealMarker;
    if (typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > resolveQuietMs(parsed)) {
      sessionStorage.removeItem(STORAGE_KEYS.postSealQuiet);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markPostSealComplete(
  opts: { hasLargeMedia?: boolean; hasVideo?: boolean; draftIds?: string[] } = {}
): void {
  if (typeof sessionStorage === "undefined") return;
  const priorityDraftIds = (opts.draftIds || [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.postSealQuiet,
      JSON.stringify({
        at: Date.now(),
        hasLargeMedia: Boolean(opts.hasLargeMedia),
        hasVideo: Boolean(opts.hasVideo),
        ...(priorityDraftIds.length ? { priorityDraftIds } : {}),
      } satisfies PostSealMarker)
    );
  } catch {
    /* quota */
  }
}

export function getPostSealPriorityDraftIds(): string[] {
  const ids = readMarker()?.priorityDraftIds;
  return Array.isArray(ids) ? ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
}

function draftIdSetKey(ids: string[]): string {
  return [...ids].map((id) => String(id).trim()).filter(Boolean).sort().join(",");
}

/** During post-seal quiet, defer pair sync and non-priority seal finalize rows. */
export function isDeferredDuringPostSealQuiet(item: {
  kind: string;
  draftIds?: string[];
}): boolean {
  if (!isPostSealQuietWindow()) return false;
  const priority = getPostSealPriorityDraftIds();
  if (item.kind === "pair_sync") return true;
  if (item.kind === "seal_finalize") {
    if (!priority.length) return false;
    const itemIds = Array.isArray(item.draftIds) ? item.draftIds : [];
    return draftIdSetKey(itemIds) !== draftIdSetKey(priority);
  }
  return false;
}

export function isPostSealQuietWindow(): boolean {
  return readMarker() != null;
}

export function getPostSealQuietRemainingMs(): number {
  const marker = readMarker();
  if (!marker) return 0;
  return Math.max(0, resolveQuietMs(marker) - (Date.now() - marker.at));
}

/** Fire once when the post-seal quiet window ends (thumb decode may resume). */
export function subscribePostSealQuietEnd(onEnd: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const remaining = getPostSealQuietRemainingMs();
  if (remaining <= 0) return () => {};
  const id = window.setTimeout(onEnd, remaining + 50);
  return () => window.clearTimeout(id);
}

export function wasPostSealLargeMedia(): boolean {
  return Boolean(readMarker()?.hasLargeMedia);
}

export function wasPostSealVideo(): boolean {
  return Boolean(readMarker()?.hasVideo);
}

/** During video post-seal quiet, block pair/cloud/sync except deferred video chunking. */
export function isHeavyPostSealBackgroundBlocked(): boolean {
  return wasPostSealVideo() && isPostSealQuietWindow();
}

export type MemoryUsageSnapshot = {
  memoryCount: number;
  oomRisk: OomRiskLevel;
  pressure: "normal" | "elevated" | "critical";
  postSealQuiet: boolean;
  postSealLargeMedia: boolean;
};

export function estimateMemoryUsage(): MemoryUsageSnapshot {
  const oomRisk = estimateOomRisk();
  return {
    memoryCount: getTotalMemoryCount(),
    oomRisk,
    pressure: oomRiskToMemoryPressure(oomRisk),
    postSealQuiet: isPostSealQuietWindow(),
    postSealLargeMedia: wasPostSealLargeMedia(),
  };
}

export function logPostSealMemoryPressure(): void {
  if (typeof console === "undefined") return;
  console.log("Post-Seal memory pressure:", estimateMemoryUsage());
}
