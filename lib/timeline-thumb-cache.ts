import { getTimelineThumbCacheMax } from "@/lib/timeline-ios-guard";
import { runTimelineDecodeTask } from "@/lib/timeline-decode-queue";
import { dataUrlToTimelineMediaBlobs } from "@/lib/timeline-media-decode";
import {
  readPersistedTimelineMedia,
  writePersistedTimelineMedia,
} from "@/lib/timeline-thumb-store";

type CacheEntry = {
  url: string;
  lastUsed: number;
};

export type TimelineThumbAcquireOpts = {
  memoryUpdatedAt?: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function thumbCacheKey(memoryId: string, memoryUpdatedAt?: number): string {
  const ts = Number(memoryUpdatedAt || 0);
  return ts > 0 ? `${memoryId}:${ts}` : memoryId;
}

function memoryIdFromCacheKey(key: string): string {
  const idx = key.lastIndexOf(":");
  if (idx <= 0) return key;
  const suffix = key.slice(idx + 1);
  if (/^\d+$/.test(suffix)) return key.slice(0, idx);
  return key;
}

function releaseCacheKey(key: string): void {
  const hit = cache.get(key);
  if (!hit) return;
  try {
    URL.revokeObjectURL(hit.url);
  } catch {
    /* ignore */
  }
  cache.delete(key);
}

function evictToLimit() {
  const max = getTimelineThumbCacheMax();
  while (cache.size > max) {
    let oldestId = "";
    let oldest = Infinity;
    for (const [id, entry] of cache) {
      if (entry.lastUsed < oldest) {
        oldest = entry.lastUsed;
        oldestId = id;
      }
    }
    if (!oldestId) break;
    releaseCacheKey(oldestId);
  }
}

function rememberBlobUrl(cacheKey: string, blob: Blob): string {
  const existing = cache.get(cacheKey);
  if (existing?.url) {
    try {
      URL.revokeObjectURL(existing.url);
    } catch {
      /* ignore */
    }
  }
  const url = URL.createObjectURL(blob);
  cache.set(cacheKey, { url, lastUsed: Date.now() });
  evictToLimit();
  return url;
}

/**
 * Resolve a low-res timeline thumbnail object URL.
 * Order: in-memory → IndexedDB thumb JPEG → queued loader (decrypt on main, resize in worker).
 */
export async function acquireTimelineThumbUrl(
  memoryId: string,
  loader: () => Promise<Blob | null>,
  opts: TimelineThumbAcquireOpts = {}
): Promise<string | null> {
  const memoryUpdatedAt = Number(opts.memoryUpdatedAt || 0);
  const cacheKey = thumbCacheKey(memoryId, memoryUpdatedAt);

  const hit = cache.get(cacheKey);
  if (hit?.url) {
    hit.lastUsed = Date.now();
    return hit.url;
  }

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const task = runTimelineDecodeTask(async () => {
    const persisted = await readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "thumb");
    if (persisted) {
      return rememberBlobUrl(cacheKey, persisted);
    }

    const sourceBlob = await loader();
    if (!sourceBlob) return null;

    const medium = await readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "medium");
    if (medium) {
      void writePersistedTimelineMedia(memoryId, memoryUpdatedAt, sourceBlob, medium);
    } else {
      void writePersistedTimelineMedia(memoryId, memoryUpdatedAt, sourceBlob, sourceBlob);
    }
    return rememberBlobUrl(cacheKey, sourceBlob);
  });

  inflight.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(cacheKey);
  }
}

/** Persist thumb (300px) + medium (800px) after save/import — worker resize, no list decode. */
export async function warmTimelineMediaFromDataUrl(
  memoryId: string,
  memoryUpdatedAt: number,
  dataUrl: string
): Promise<void> {
  if (!memoryId || !dataUrl) return;
  await runTimelineDecodeTask(async () => {
    const existing = await readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "thumb");
    if (existing) return;
    const { thumb, medium } = await dataUrlToTimelineMediaBlobs(dataUrl);
    if (!thumb || !medium) return;
    await writePersistedTimelineMedia(memoryId, memoryUpdatedAt, thumb, medium);
  });
}

/** @deprecated Use warmTimelineMediaFromDataUrl */
export async function warmTimelineThumbFromDataUrl(
  memoryId: string,
  memoryUpdatedAt: number,
  dataUrl: string
): Promise<void> {
  return warmTimelineMediaFromDataUrl(memoryId, memoryUpdatedAt, dataUrl);
}

export function releaseTimelineThumbUrl(memoryId: string): void {
  for (const key of [...cache.keys()]) {
    if (memoryIdFromCacheKey(key) === memoryId) {
      releaseCacheKey(key);
    }
  }
}

/** Revoke object URLs for rows outside the virtual viewport immediately. */
export function retainTimelineThumbUrls(keepIds: Set<string>): void {
  for (const key of cache.keys()) {
    if (!keepIds.has(memoryIdFromCacheKey(key))) {
      releaseCacheKey(key);
    }
  }
}

export function releaseAllTimelineThumbUrls(): void {
  for (const key of [...cache.keys()]) {
    releaseCacheKey(key);
  }
  inflight.clear();
}
