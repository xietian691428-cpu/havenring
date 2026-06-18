import {
  getTimelineMediumMaxDim,
  getTimelinePersistedThumbMax,
  getTimelineThumbMaxDim,
} from "@/lib/timeline-ios-guard";

const DB_NAME = "haven_timeline_thumbs_v1";
const DB_VERSION = 2;
const STORE_MEDIA = "media";

export type TimelineMediaVariant = "thumb" | "medium";

export type PersistedTimelineMedia = {
  memoryId: string;
  memoryUpdatedAt: number;
  thumbMaxDim: number;
  mediumMaxDim: number;
  thumbBlob: Blob;
  mediumBlob: Blob;
  storedAt: number;
};

function openThumbDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb-unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains("thumbs")) {
        db.deleteObjectStore("thumbs");
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        const store = db.createObjectStore(STORE_MEDIA, { keyPath: "memoryId" });
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

function isValidMediaRow(
  row: PersistedTimelineMedia | null | undefined,
  memoryUpdatedAt: number
): row is PersistedTimelineMedia {
  if (!row?.thumbBlob || !(row.thumbBlob instanceof Blob)) return false;
  if (!row?.mediumBlob || !(row.mediumBlob instanceof Blob)) return false;
  if (row.thumbMaxDim !== getTimelineThumbMaxDim()) return false;
  if (row.mediumMaxDim !== getTimelineMediumMaxDim()) return false;
  if (Number(row.memoryUpdatedAt || 0) !== Number(memoryUpdatedAt || 0)) return false;
  return row.thumbBlob.size > 0 && row.mediumBlob.size > 0;
}

function pickVariantBlob(
  row: PersistedTimelineMedia,
  variant: TimelineMediaVariant
): Blob {
  return variant === "medium" ? row.mediumBlob : row.thumbBlob;
}

export async function readPersistedTimelineMedia(
  memoryId: string,
  memoryUpdatedAt: number,
  variant: TimelineMediaVariant = "thumb"
): Promise<Blob | null> {
  if (!memoryId || typeof indexedDB === "undefined") return null;
  const db = await openThumbDb();
  try {
    const row = await new Promise<PersistedTimelineMedia | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, "readonly");
      const req = tx.objectStore(STORE_MEDIA).get(memoryId);
      req.onsuccess = () => resolve((req.result ?? null) as PersistedTimelineMedia | null);
      req.onerror = () => reject(req.error ?? new Error("thumb-read-failed"));
    });
    if (!isValidMediaRow(row, memoryUpdatedAt)) {
      if (row) await deletePersistedTimelineMedia(memoryId);
      return null;
    }
    return pickVariantBlob(row, variant);
  } catch {
    return null;
  } finally {
    db.close();
  }
}

/** @deprecated Use readPersistedTimelineMedia */
export async function readPersistedTimelineThumb(
  memoryId: string,
  memoryUpdatedAt: number
): Promise<Blob | null> {
  return readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "thumb");
}

async function prunePersistedTimelineMedia(db: IDBDatabase): Promise<void> {
  const max = getTimelinePersistedThumbMax();
  const rows = await new Promise<PersistedTimelineMedia[]>((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, "readonly");
    const req = tx.objectStore(STORE_MEDIA).getAll();
    req.onsuccess = () => resolve((req.result || []) as PersistedTimelineMedia[]);
    req.onerror = () => reject(req.error ?? new Error("thumb-list-failed"));
  });
  if (rows.length <= max) return;
  const sorted = [...rows].sort(
    (a, b) => Number(a.storedAt || 0) - Number(b.storedAt || 0)
  );
  const remove = sorted.slice(0, rows.length - max);
  const tx = db.transaction(STORE_MEDIA, "readwrite");
  const store = tx.objectStore(STORE_MEDIA);
  for (const row of remove) {
    store.delete(row.memoryId);
  }
  await txDone(tx);
}

export async function writePersistedTimelineMedia(
  memoryId: string,
  memoryUpdatedAt: number,
  thumbBlob: Blob,
  mediumBlob: Blob
): Promise<void> {
  if (!memoryId || !thumbBlob || !mediumBlob || typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const row: PersistedTimelineMedia = {
      memoryId,
      memoryUpdatedAt: Number(memoryUpdatedAt || 0),
      thumbMaxDim: getTimelineThumbMaxDim(),
      mediumMaxDim: getTimelineMediumMaxDim(),
      thumbBlob,
      mediumBlob,
      storedAt: Date.now(),
    };
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    tx.objectStore(STORE_MEDIA).put(row);
    await txDone(tx);
    await prunePersistedTimelineMedia(db);
  } catch {
    /* best-effort cache */
  } finally {
    db.close();
  }
}

/** @deprecated Use writePersistedTimelineMedia */
export async function writePersistedTimelineThumb(
  memoryId: string,
  memoryUpdatedAt: number,
  blob: Blob
): Promise<void> {
  await writePersistedTimelineMedia(memoryId, memoryUpdatedAt, blob, blob);
}

export async function deletePersistedTimelineMedia(memoryId: string): Promise<void> {
  if (!memoryId || typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    tx.objectStore(STORE_MEDIA).delete(memoryId);
    await txDone(tx);
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}

/** @deprecated */
export async function deletePersistedTimelineThumb(memoryId: string): Promise<void> {
  return deletePersistedTimelineMedia(memoryId);
}

export async function clearAllPersistedTimelineThumbs(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openThumbDb();
  try {
    const tx = db.transaction(STORE_MEDIA, "readwrite");
    tx.objectStore(STORE_MEDIA).clear();
    await txDone(tx);
  } catch {
    /* ignore */
  } finally {
    db.close();
  }
}

export async function readPersistedTimelineMedium(
  memoryId: string,
  memoryUpdatedAt: number
): Promise<Blob | null> {
  return readPersistedTimelineMedia(memoryId, memoryUpdatedAt, "medium");
}
