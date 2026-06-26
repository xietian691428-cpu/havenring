import {
  MEMORY_DB_NAME,
  openMemoryDb,
  STORE_VIDEO_CHUNKS,
  txDone,
} from "@/lib/memory-db";
import {
  VIDEO_CHUNK_BYTES,
  videoChunkStoreId,
  type VideoChunkRecord,
} from "@/lib/memory-video-types";

export async function putVideoBlobChunked(
  memoryId: string,
  attachmentId: string,
  blob: Blob
): Promise<number> {
  const scopedMemoryId = String(memoryId || "").trim();
  const scopedAttachmentId = String(attachmentId || "").trim();
  if (!scopedMemoryId || !scopedAttachmentId || !(blob instanceof Blob)) return 0;

  const chunkCount = Math.max(1, Math.ceil(blob.size / VIDEO_CHUNK_BYTES));
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_VIDEO_CHUNKS, "readwrite");
    const store = tx.objectStore(STORE_VIDEO_CHUNKS);
    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * VIDEO_CHUNK_BYTES;
      const end = Math.min(blob.size, start + VIDEO_CHUNK_BYTES);
      const slice = blob.slice(start, end);
      const record: VideoChunkRecord = {
        id: videoChunkStoreId(scopedMemoryId, scopedAttachmentId, i),
        memoryId: scopedMemoryId,
        attachmentId: scopedAttachmentId,
        chunkIndex: i,
        chunkCount,
        mimeType: blob.type || "video/mp4",
        size: slice.size,
        data: slice,
      };
      store.put(record);
    }
    await txDone(tx);
    return chunkCount;
  } finally {
    db.close();
  }
}

async function readChunkRecords(
  memoryId: string,
  attachmentId: string
): Promise<VideoChunkRecord[]> {
  const db = await openMemoryDb();
  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEO_CHUNKS, "readonly");
      const store = tx.objectStore(STORE_VIDEO_CHUNKS);
      const index = store.index("attachmentId");
      const req = index.getAll(attachmentId);
      req.onsuccess = () => {
        const rows = (req.result || []) as VideoChunkRecord[];
        resolve(
          rows
            .filter((row) => String(row.memoryId || "") === memoryId)
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
        );
      };
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read video chunks."));
    });
  } finally {
    db.close();
  }
}

export async function getVideoBlobForMemory(
  memoryId: string,
  attachmentId: string
): Promise<Blob | null> {
  const chunks = await readChunkRecords(memoryId, attachmentId);
  if (!chunks.length) return null;
  const mimeType = chunks[0]?.mimeType || "video/mp4";
  const parts = chunks.map((row) => row.data).filter((blob) => blob instanceof Blob);
  if (!parts.length) return null;
  return new Blob(parts, { type: mimeType });
}

export async function deleteVideoBlobsForMemory(memoryId: string): Promise<void> {
  const scopedMemoryId = String(memoryId || "").trim();
  if (!scopedMemoryId) return;
  const db = await openMemoryDb();
  try {
    const rows = await new Promise<VideoChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_VIDEO_CHUNKS, "readonly");
      const index = tx.objectStore(STORE_VIDEO_CHUNKS).index("memoryId");
      const req = index.getAll(scopedMemoryId);
      req.onsuccess = () => resolve((req.result || []) as VideoChunkRecord[]);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to list video chunks."));
    });
    if (!rows.length) return;
    const tx = db.transaction(STORE_VIDEO_CHUNKS, "readwrite");
    const store = tx.objectStore(STORE_VIDEO_CHUNKS);
    for (const row of rows) {
      store.delete(row.id);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteVideoBlobsForMemoryAttachmentIds(
  memoryId: string,
  attachmentIds: string[]
): Promise<void> {
  const scopedMemoryId = String(memoryId || "").trim();
  const ids = attachmentIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!scopedMemoryId || !ids.length) return;
  for (const attachmentId of ids) {
    const chunks = await readChunkRecords(scopedMemoryId, attachmentId);
    if (!chunks.length) continue;
    const db = await openMemoryDb();
    try {
      const tx = db.transaction(STORE_VIDEO_CHUNKS, "readwrite");
      const store = tx.objectStore(STORE_VIDEO_CHUNKS);
      for (const row of chunks) {
        store.delete(row.id);
      }
      await txDone(tx);
    } finally {
      db.close();
    }
  }
}

export async function clearAllVideoChunks(): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_VIDEO_CHUNKS, "readwrite");
    tx.objectStore(STORE_VIDEO_CHUNKS).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}
