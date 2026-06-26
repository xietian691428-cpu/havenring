export const MEMORY_DB_NAME = "haven_ring_memories_db";
export const MEMORY_DB_VERSION = 5;
export const STORE_MEMORIES = "memories";
export const STORE_PHOTO_BLOBS = "photoBlobs";
export const STORE_VIDEO_CHUNKS = "videoChunks";
export const STORE_MEMORY_SUPPLEMENTS = "memorySupplements";

export function openMemoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEMORY_DB_NAME, MEMORY_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("timelineAt", "timelineAt");
      }
      if (!db.objectStoreNames.contains(STORE_PHOTO_BLOBS)) {
        const blobs = db.createObjectStore(STORE_PHOTO_BLOBS, { keyPath: "id" });
        blobs.createIndex("memoryId", "memoryId", { unique: false });
        blobs.createIndex("photoId", "photoId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_MEMORY_SUPPLEMENTS)) {
        db.createObjectStore(STORE_MEMORY_SUPPLEMENTS, { keyPath: "memoryId" });
      }
      if (!db.objectStoreNames.contains(STORE_VIDEO_CHUNKS)) {
        const chunks = db.createObjectStore(STORE_VIDEO_CHUNKS, { keyPath: "id" });
        chunks.createIndex("memoryId", "memoryId", { unique: false });
        chunks.createIndex("attachmentId", "attachmentId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to open memory database."));
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}
