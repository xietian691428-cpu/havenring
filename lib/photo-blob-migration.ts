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
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { deferEntryWork } from "@/lib/entry-defer";
import { shouldAllowIosLegacyMigration } from "@/lib/ios-app-boot";

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
let cachedMemoryIds: string[] | null = null;
let lastMigrationScheduleAt = 0;

const IOS_MIGRATION_CHAIN_GAP_MS = 2_500;
/** Min ms between migration schedule attempts (refresh spam). */
const MIGRATION_SCHEDULE_COOLDOWN_MS = 5_000;

async function listMemoryIdsForMigration(): Promise<string[]> {
  if (cachedMemoryIds?.length) return cachedMemoryIds;
  const db = await openMemoryDb();
  try {
    cachedMemoryIds = await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []) as Array<string | number>;
        resolve(keys.map((key) => String(key)));
      };
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memory ids for migration."));
    });
    return cachedMemoryIds;
  } finally {
    db.close();
  }
}

function invalidateMigrationIdCache(): void {
  cachedMemoryIds = null;
}

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
  const ids = await listMemoryIdsForMigration();
  if (!ids.length) return false;

  const db = await openMemoryDb();
  try {
    const start = migrationCursor % ids.length;
    for (let offset = 0; offset < ids.length; offset += 1) {
      const memoryId = ids[(start + offset) % ids.length];
      migrationCursor = (start + offset + 1) % ids.length;
      const record = await new Promise<MemoryDbRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readonly");
        const req = tx.objectStore(STORE_MEMORIES).get(memoryId);
        req.onsuccess = () => resolve((req.result ?? null) as MemoryDbRecord | null);
        req.onerror = () =>
          reject(req.error ?? new Error("Failed to read memory for migration."));
      });
      if (!record) continue;
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
      invalidateMigrationIdCache();
      return true;
    }
    return false;
  } finally {
    db.close();
  }
}

export function scheduleLegacyPhotoBlobMigration(): void {
  if (typeof window === "undefined") return;
  if (!shouldAllowIosLegacyMigration()) {
    if (isIosWebKit()) {
      deferEntryWork(() => scheduleLegacyPhotoBlobMigration(), { timeout: 12_000 });
    }
    return;
  }
  if (migrationScheduled) return;
  const now = Date.now();
  if (now - lastMigrationScheduleAt < MIGRATION_SCHEDULE_COOLDOWN_MS) return;
  lastMigrationScheduleAt = now;
  migrationScheduled = true;
  const run = () => {
    migrationScheduled = false;
    void migrateOneLegacyMemoryRecord().then((didWork) => {
      if (!didWork) return;
      if (isIosWebKit()) {
        window.setTimeout(() => scheduleLegacyPhotoBlobMigration(), IOS_MIGRATION_CHAIN_GAP_MS);
        return;
      }
      scheduleLegacyPhotoBlobMigration();
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: isIosWebKit() ? 8_000 : 5_000 });
  } else {
    window.setTimeout(run, isIosWebKit() ? 2_400 : 1_200);
  }
}

export { firstPhotoRef, photosHaveInlineDataUrls, MEMORY_DB_NAME };
