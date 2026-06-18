import {
  MEMORY_DB_NAME,
  openMemoryDb,
  STORE_PHOTO_BLOBS,
  txDone,
} from "@/lib/memory-db";
import {
  photoBlobStoreId,
  type PhotoBlobRecord,
  type PhotoBlobType,
} from "@/lib/memory-photo-types";

export async function putPhotoBlobRecord(record: PhotoBlobRecord): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_PHOTO_BLOBS, "readwrite");
    tx.objectStore(STORE_PHOTO_BLOBS).put(record);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function putPhotoBlobVariants(
  memoryId: string,
  photoId: string,
  variants: Record<PhotoBlobType, Blob>
): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_PHOTO_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_PHOTO_BLOBS);
    for (const type of ["thumb", "medium", "full"] as PhotoBlobType[]) {
      const blob = variants[type];
      if (!(blob instanceof Blob)) continue;
      const record: PhotoBlobRecord = {
        id: photoBlobStoreId(photoId, type),
        photoId,
        memoryId,
        type,
        size: blob.size,
        mimeType: blob.type || "image/jpeg",
        data: blob,
      };
      store.put(record);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function getPhotoBlob(
  photoId: string,
  type: PhotoBlobType
): Promise<Blob | null> {
  const db = await openMemoryDb();
  try {
    const record = await new Promise<PhotoBlobRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTO_BLOBS, "readonly");
      const req = tx.objectStore(STORE_PHOTO_BLOBS).get(photoBlobStoreId(photoId, type));
      req.onsuccess = () => resolve((req.result ?? null) as PhotoBlobRecord | null);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read photo blob."));
    });
    return record?.data instanceof Blob ? record.data : null;
  } finally {
    db.close();
  }
}

export async function deletePhotoBlobsForMemory(memoryId: string): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_PHOTO_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_PHOTO_BLOBS);
    const index = store.index("memoryId");
    await new Promise<void>((resolve, reject) => {
      const req = index.openCursor(IDBKeyRange.only(memoryId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        cursor.delete();
        cursor.continue();
      };
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to delete photo blobs."));
    });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deletePhotoBlobsForPhotoIds(photoIds: string[]): Promise<void> {
  if (!photoIds.length) return;
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_PHOTO_BLOBS, "readwrite");
    const store = tx.objectStore(STORE_PHOTO_BLOBS);
    for (const photoId of photoIds) {
      for (const type of ["thumb", "medium", "full"] as PhotoBlobType[]) {
        store.delete(photoBlobStoreId(photoId, type));
      }
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function listPhotoIdsForMemory(memoryId: string): Promise<string[]> {
  const db = await openMemoryDb();
  try {
    const ids = new Set<string>();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PHOTO_BLOBS, "readonly");
      const index = tx.objectStore(STORE_PHOTO_BLOBS).index("memoryId");
      const req = index.openCursor(IDBKeyRange.only(memoryId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve();
          return;
        }
        const row = cursor.value as PhotoBlobRecord;
        if (row?.photoId) ids.add(row.photoId);
        cursor.continue();
      };
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to list photo blobs."));
    });
    return [...ids];
  } finally {
    db.close();
  }
}

export { MEMORY_DB_NAME, STORE_PHOTO_BLOBS };
