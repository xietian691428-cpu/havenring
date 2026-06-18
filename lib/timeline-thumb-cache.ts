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
    releaseTimelineThumbUrl(oldestId);
  }
}

function rememberBlobUrl(memoryId: string, blob: Blob): string {
  const existing = cache.get(memoryId);
  if (existing?.url) {
    try {
      URL.revokeObjectURL(existing.url);
    } catch {
      /* ignore */
    }
  }
  const url = URL.createObjectURL(blob);
  cache.set(memoryId, { url, lastUsed: Date.now() });
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

  const hit = cache.get(memoryId);
  if (hit?.url) {
    hit.lastUsed = Date.now();
    return hit.url;
  }

  const pending = inflight.get(memoryId);
  if (pending) return pending;

  const task = runTimelineDecodeTask(async () => {
    const persisted = await readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "thumb");
    if (persisted) {
      return rememberBlobUrl(memoryId, persisted);
    }

    const sourceBlob = await loader();
    if (!sourceBlob) return null;

    const medium = await readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "medium");
    if (medium) {
      void writePersistedTimelineMedia(memoryId, memoryUpdatedAt, sourceBlob, medium);
    } else {
      void writePersistedTimelineMedia(memoryId, memoryUpdatedAt, sourceBlob, sourceBlob);
    }
    return rememberBlobUrl(memoryId, sourceBlob);
  });

  inflight.set(memoryId, task);
  try {
    return await task;
  } finally {
    inflight.delete(memoryId);
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
  const hit = cache.get(memoryId);
  if (!hit) return;
  try {
    URL.revokeObjectURL(hit.url);
  } catch {
    /* ignore */
  }
  cache.delete(memoryId);
}

/** Revoke object URLs for rows outside the virtual viewport immediately. */
export function retainTimelineThumbUrls(keepIds: Set<string>): void {
  for (const id of cache.keys()) {
    if (!keepIds.has(id)) {
      releaseTimelineThumbUrl(id);
    }
  }
}

export function releaseAllTimelineThumbUrls(): void {
  for (const id of [...cache.keys()]) {
    releaseTimelineThumbUrl(id);
  }
  inflight.clear();
}
