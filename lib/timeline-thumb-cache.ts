import { getTimelineThumbCacheMax, getTimelineThumbMaxDim } from "@/lib/timeline-ios-guard";
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

async function dataUrlToLowResBlob(dataUrl: string, maxDim: number): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("thumb-decode-failed"));
    el.src = dataUrl;
  });
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    return null;
  }
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      0.72
    );
  });
}

/**
 * Resolve a low-res timeline thumbnail object URL.
 * Order: in-memory → IndexedDB persisted JPEG → canvas decode from source.
 */
export async function acquireTimelineThumbUrl(
  memoryId: string,
  loader: () => Promise<string | null>,
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

  const task = (async () => {
    const persisted = await readPersistedTimelineThumb(memoryId, memoryUpdatedAt);
    if (persisted) {
      return rememberBlobUrl(memoryId, persisted);
    }

    const dataUrl = await loader();
    if (!dataUrl) return null;
    const blob = await dataUrlToLowResBlob(dataUrl, getTimelineThumbMaxDim());
    if (!blob) return null;

    void writePersistedTimelineThumb(memoryId, memoryUpdatedAt, blob);
    return rememberBlobUrl(memoryId, blob);
  })();

  inflight.set(memoryId, task);
  try {
    return await task;
  } finally {
    inflight.delete(memoryId);
  }
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
}
