import { getTimelineThumbCacheMax, getTimelineThumbMaxDim } from "@/lib/timeline-ios-guard";
import { runTimelineDecodeTask } from "@/lib/timeline-decode-queue";
import { dataUrlToTimelineThumbBlob } from "@/lib/timeline-media-decode";
import {
  readPersistedTimelineThumb,
  writePersistedTimelineThumb,
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
    const entry = cache.get(oldestId);
    if (entry?.url) {
      try {
        URL.revokeObjectURL(entry.url);
      } catch {
        /* ignore */
      }
    }
    cache.delete(oldestId);
  }
}

function rememberBlobUrl(memoryId: string, blob: Blob): string {
  const url = URL.createObjectURL(blob);
  cache.set(memoryId, { url, lastUsed: Date.now() });
  evictToLimit();
  return url;
}

/**
 * Resolve a low-res timeline thumbnail object URL.
 * Order: in-memory → IndexedDB persisted JPEG → queued decode from source blob.
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
    const persisted = await readPersistedTimelineThumb(memoryId, memoryUpdatedAt);
    if (persisted) {
      return rememberBlobUrl(memoryId, persisted);
    }

    const sourceBlob = await loader();
    if (!sourceBlob) return null;

    void writePersistedTimelineThumb(memoryId, memoryUpdatedAt, sourceBlob);
    return rememberBlobUrl(memoryId, sourceBlob);
  });

  inflight.set(memoryId, task);
  try {
    return await task;
  } finally {
    inflight.delete(memoryId);
  }
}

/** Persist a generated thumb after save/import so timeline never decodes full photos. */
export async function warmTimelineThumbFromDataUrl(
  memoryId: string,
  memoryUpdatedAt: number,
  dataUrl: string
): Promise<void> {
  if (!memoryId || !dataUrl) return;
  await runTimelineDecodeTask(async () => {
    const existing = await readPersistedTimelineThumb(memoryId, memoryUpdatedAt);
    if (existing) return;
    const blob = await dataUrlToTimelineThumbBlob(dataUrl, getTimelineThumbMaxDim());
    if (!blob) return;
    await writePersistedTimelineThumb(memoryId, memoryUpdatedAt, blob);
  });
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

/** Drop in-memory object URLs not in the virtual viewport (persisted IDB rows remain). */
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
