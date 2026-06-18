import { resolveMemoryPhotoUrl } from "@/lib/memory-photo-display";
import { localCrypto } from "@/src/services/encryptionService";
import { buildPreparedComposerPhoto } from "@/lib/photo-blob-prep";
import {
  deletePhotoBlobsForPhotoIds,
  putPhotoBlobVariants,
} from "@/lib/photo-blob-store";
import {
  firstPhotoRef,
  isMemoryPhotoRef,
  photoRowHasInlineDataUrl,
  photosHaveInlineDataUrls,
  type MemoryPhotoRef,
} from "@/lib/memory-photo-types";
import {
  MEMORY_DB_NAME,
  openMemoryDb,
  STORE_MEMORIES,
  txDone,
} from "@/lib/memory-db";

type EncPayload = {
  alg: string;
  iv: string;
  data: string;
  ts: number;
};

type MemoryDbRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  timelineAt: number;
  title: string;
  tags: unknown[];
  storyEnc: EncPayload;
  photoEnc: EncPayload;
  voiceEnc: EncPayload | null;
  voicePlain: unknown | null;
  attachmentsEnc: EncPayload;
  metaEnc: EncPayload;
};

let migrationCursor = 0;
let migrationScheduled = false;

function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function migrateInlinePhotoRow(
  memoryId: string,
  row: unknown
): Promise<MemoryPhotoRef | null> {
  if (!row || typeof row !== "object") return null;
  if (isMemoryPhotoRef(row)) return row;
  if (!photoRowHasInlineDataUrl(row)) {
    const typed = row as MemoryPhotoRef;
    return typeof typed.id === "string" ? typed : null;
  }
  const typed = row as {
    id?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    dataUrl?: string;
    src?: string;
    url?: string;
  };
  const dataUrl = typed.dataUrl || typed.src || typed.url || "";
  const prepared = await buildPreparedComposerPhoto({
    id: String(typed.id || crypto.randomUUID()),
    name: typed.name,
    mimeType: typed.mimeType,
    size: typed.size,
    dataUrl,
  });
  if (!prepared) return null;
  await putPhotoBlobVariants(memoryId, prepared.ref.id, prepared.blobs);
  return prepared.ref;
}

export async function migrateInlinePhotosToRefs(
  memoryId: string,
  photos: unknown
): Promise<MemoryPhotoRef[]> {
  const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
  const refs: MemoryPhotoRef[] = [];
  for (const row of rows) {
    const ref = await migrateInlinePhotoRow(memoryId, row);
    if (ref) refs.push(ref);
    await yieldToMain();
  }
  return refs;
}

async function rewriteMemoryPhotoEnc(
  record: MemoryDbRecord,
  refs: MemoryPhotoRef[]
): Promise<void> {
  const db = await openMemoryDb();
  try {
    const photoEnc = await localCrypto.encryptJson(refs.length ? refs : null);
    const meta = await localCrypto.decryptJson(record.metaEnc);
    const metaObj = meta as Record<string, unknown>;
    const metaEnc = await localCrypto.encryptJson({
      ...metaObj,
      hasPhotos: refs.length > 0,
      photoCount: refs.length,
    });
    const next: MemoryDbRecord = {
      ...record,
      updatedAt: Date.now(),
      photoEnc,
      metaEnc,
    };
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).put(next);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function migrateOneLegacyMemoryRecord(): Promise<boolean> {
  const db = await openMemoryDb();
  try {
    const records = await new Promise<MemoryDbRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).getAll();
      req.onsuccess = () => resolve((req.result || []) as MemoryDbRecord[]);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memories for migration."));
    });
    if (!records.length) return false;
    const start = migrationCursor % records.length;
    for (let offset = 0; offset < records.length; offset += 1) {
      const record = records[(start + offset) % records.length];
      migrationCursor = (start + offset + 1) % records.length;
      const photos = await localCrypto.decryptJson(record.photoEnc);
      if (!photosHaveInlineDataUrls(photos)) continue;
      const refs = await migrateInlinePhotosToRefs(record.id, photos);
      const oldIds = (Array.isArray(photos) ? photos : [photos])
        .map((row) =>
          row && typeof row === "object" ? String((row as { id?: string }).id || "") : ""
        )
        .filter(Boolean);
      const nextIds = new Set(refs.map((ref) => ref.id));
      const removed = oldIds.filter((id) => !nextIds.has(id));
      if (removed.length) await deletePhotoBlobsForPhotoIds(removed);
      await rewriteMemoryPhotoEnc(record, refs);
      return true;
    }
    return false;
  } finally {
    db.close();
  }
}

export function scheduleLegacyPhotoBlobMigration(): void {
  if (typeof window === "undefined") return;
  if (migrationScheduled) return;
  migrationScheduled = true;
  const run = () => {
    migrationScheduled = false;
    void migrateOneLegacyMemoryRecord().then((didWork) => {
      if (didWork) scheduleLegacyPhotoBlobMigration();
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 5000 });
  } else {
    window.setTimeout(run, 1200);
  }
}

export { firstPhotoRef, photosHaveInlineDataUrls, MEMORY_DB_NAME };
