import { getTimelinePersistedThumbMax, getTimelineThumbMaxDim } from "@/lib/timeline-ios-guard";

const DB_NAME = "haven_timeline_thumbs_v1";
const DB_VERSION = 1;
const STORE_THUMBS = "thumbs";

export type PersistedTimelineThumb = {
  memoryId: string;
  memoryUpdatedAt: number;
  maxDim: number;
  storedAt: number;
  blob: Blob;
};

type ThumbRow = PersistedTimelineThumb;

function openThumbDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb-unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_THUMBS)) {
        const store = db.createObjectStore(STORE_THUMBS, { keyPath: "memoryId" });
        store.createIndex("storedAt", "storedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("thumb-db-open-failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("thumb-db-tx-failed"));
    tx.onabort = () => reject(tx.error ?? new Error("thumb-db-tx-aborted"));
  });
}

function isValidThumbRow(
  row: ThumbRow | null | undefined,
  memoryUpdatedAt: number
): row is ThumbRow {
  if (!row?.blob || !(row.blob instanceof Blob)) return false;
  if (row.maxDim !== getTimelineThumbMaxDim()) return false;
  if (Number(row.memoryUpdatedAt || 0) !== Number(memoryUpdatedAt || 0)) return false;
  return row.blob.size > 0;
}

/**
 * Read a persisted JPEG thumb when it still matches the memory revision.
 */
export async function readPersistedTimelineThumb(
  memoryId: string,
  memoryUpdatedAt: number
): Promise<Blob | null> {
  if (!memoryId || typeof indexedDB === "undefined") return null;
  const db = await openThumbDb();
  try {
    const row = await new Promise<ThumbRow | null>((resolve, reject) => {
      const tx = db.transaction(STORE_THUMBS, "readonly");
      const req = tx.objectStore(STORE_THUMBS).get(memoryId);
      req.onsuccess = () => resolve((req.result ?? null) as ThumbRow | null);
      req.onerror = () => reject(req.error ?? new Error("thumb-read-failed"));
    });
    if (!isValidThumbRow(row, memoryUpdatedAt)) {
      if (row) await deletePersistedTimelineThumb(memoryId);
      return null;
    }
    return row.blob;
  } catch {
    return null;
  } finally {
    db.close();
  }
}

async function prunePersistedTimelineThumbs(db: IDBDatabase): Promise<void> {
  const max = getTimelinePersistedThumbMax();
  const rows = await new Promise<ThumbRow[]>((resolve, reject) => {
    const tx = db.transaction(STORE_THUMBS, "readonly");
    const req = tx.objectStore(STORE_THUMBS).getAll();
    req.onsuccess = () => resolve((req.result || []) as ThumbRow[]);
    req.onerror = () => reject(req.error ?? new Error("thumb-list-failed"));
  });
  if (rows.length <= max) return;
  const sorted = [...rows].sort(
    (a, b) => Number(a.storedAt || 0) - Number(b.storedAt || 0)
  );
  const remove = sorted.slice(0, rows.length - max);
  const tx = db.transaction(STORE_THUMBS, "readwrite");
  const store = tx.objectStore(STORE_THUMBS);
  for (const row of remove) {
    store.delete(row.memoryId);
  }
  await txDone(tx);
}

/**
 * Persist a generated timeline thumb blob (JPEG).
 */
export async function writePersistedTimelineThumb(
  memoryId: string,
  memoryUpdatedAt: number,
  blob: Blob
): Promise<void> {
  if (!memoryId || !blob || typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const row: ThumbRow = {
      memoryId,
      memoryUpdatedAt: Number(memoryUpdatedAt || 0),
      maxDim: getTimelineThumbMaxDim(),
      storedAt: Date.now(),
      blob,
    };
    const tx = db.transaction(STORE_THUMBS, "readwrite");
    tx.objectStore(STORE_THUMBS).put(row);
    await txDone(tx);
    await prunePersistedTimelineThumbs(db);
  } catch {
    /* best-effort cache */
  } finally {
    db.close();
  }
}

export async function deletePersistedTimelineThumb(memoryId: string): Promise<void> {
  if (!memoryId || typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const tx = db.transaction(STORE_THUMBS, "readwrite");
    tx.objectStore(STORE_THUMBS).delete(memoryId);
    await txDone(tx);
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}

export async function clearAllPersistedTimelineThumbs(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const tx = db.transaction(STORE_THUMBS, "readwrite");
    tx.objectStore(STORE_THUMBS).clear();
    await txDone(tx);
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}
