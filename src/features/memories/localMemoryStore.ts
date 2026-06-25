/**
 * Local-first memory persistence (IndexedDB) — **feature-layer** canonical module.
 *
 * - Physical storage + encryption orchestration lives here.
 * - Field crypto uses {@link ../../services/encryptionService localCrypto}; do not encrypt in UI layers.
 * - Stable DB name/version: migrating schema must bump DB_VERSION with upgrade path.
 *
 * Prefer `@/src/features/memories` or `memoryRepository` from `./memoryRepository`.
 * `@/src/services/localMemoryStore` and `localStorageService.js` re-export for backward compat.
 */

import { localCrypto } from "../../services/encryptionService";
import {
  getTimelineStoryPreviewMaxChars,
  isMobileMemorySensitive,
} from "@/lib/timeline-ios-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { runTimelineDecodeTask } from "@/lib/timeline-decode-queue";
import {
  dataUrlToTimelineMediaBlobs,
  dataUrlToTimelineThumbBlob,
  firstPhotoDataUrl,
} from "@/lib/timeline-media-decode";
import {
  clearAllPersistedTimelineThumbs,
  deletePersistedTimelineThumb,
  readPersistedTimelineMedia,
  writePersistedTimelineMedia,
} from "@/lib/timeline-thumb-store";
import { warmTimelineMediaFromDataUrl } from "@/lib/timeline-thumb-cache";
import { photoPayloadHasLargeBlob } from "@/lib/timeline-large-media";
import { isPostSealQuietWindow, markPostSealComplete } from "@/lib/post-seal-memory-guard";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { logStorageEstimate } from "@/lib/storage-quota";
import type { TimelineMemoryPage, TimelineMemorySummary } from "@/lib/timeline-memory-types";
import {
  isPreparedComposerPhoto,
  isMemoryPhotoRef,
  photoRowHasInlineDataUrl,
  firstPhotoRef,
  type MemoryPhotoRef,
  type PhotoBlobType,
} from "@/lib/memory-photo-types";
import {
  deletePhotoBlobsForMemory,
  deletePhotoBlobsForPhotoIds,
  getPhotoBlob,
  listPhotoIdsForMemory,
  putPhotoBlobVariants,
} from "@/lib/photo-blob-store";
import {
  migrateInlinePhotosToRefs,
  scheduleLegacyPhotoBlobMigration,
} from "@/lib/photo-blob-migration";
import { setCachedMemoryCount } from "@/lib/ios-memory-heuristics";
import {
  openMemoryDb,
  STORE_MEMORIES,
  STORE_PHOTO_BLOBS,
  txDone,
} from "@/lib/memory-db";
import { mergeSupplements, type MemorySupplement } from "@/lib/memory-supplements";
import {
  clearAllMemorySupplements,
  deleteSupplementsForMemory,
  resolveMemorySupplements,
  writeSupplementsForMemory,
} from "@/lib/memory-supplements-store";

export type { MemorySupplement };

export type LocalMemory = {
  id: string;
  title: string;
  story: string;
  photo: unknown;
  voice: unknown;
  attachments: unknown[];
  createdAt: number;
  updatedAt: number;
  timelineAt: number;
  releaseAt: number;
  tags: unknown[];
  is_sealed?: boolean;
  coreLocked?: boolean;
  pairShared?: boolean;
  /** Local seal ritual completed (source of truth). */
  locallySealedAt?: number;
  /** Server finalize ticket consumed (async audit). */
  serverSealedAt?: number;
  ring_id?: string | null;
  haven_id?: string | null;
  createdByUserId?: string | null;
  fromPartner?: boolean;
  supplements?: MemorySupplement[];
};

export type MemoryUpsertPayload = Partial<LocalMemory> & {
  id?: string;
  /** When false-ish, legacy voice stored as plaintext in record (backward compat). */
  encryptVoice?: boolean;
};

export type MemorySaveOptions = {
  /** Allow editing sealed core fields (title/story/media). Default false when coreLocked. */
  allowCoreEdit?: boolean;
};

export type MemoryCreatedMeta = Pick<LocalMemory, "id" | "createdAt" | "updatedAt">;

export type MemorySavedMeta = Pick<LocalMemory, "id" | "updatedAt">;

const openDb = openMemoryDb;

type EncPayload = {
  alg: string;
  iv: string;
  data: string;
  ts: number;
};

/** Row shape as stored on disk (title/tags plain; payloads encrypted). */
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

async function persistPhotoInputs(
  memoryId: string,
  photo: unknown,
  previousPhotoIds: string[] = []
): Promise<MemoryPhotoRef[] | null> {
  if (photo == null) {
    if (previousPhotoIds.length) {
      await deletePhotoBlobsForPhotoIds(previousPhotoIds);
    }
    return null;
  }

  const rows = Array.isArray(photo) ? photo : [photo];
  if (!rows.length) {
    if (previousPhotoIds.length) {
      await deletePhotoBlobsForPhotoIds(previousPhotoIds);
    }
    return null;
  }

  const refs: MemoryPhotoRef[] = [];
  for (const row of rows) {
    if (isPreparedComposerPhoto(row)) {
      await putPhotoBlobVariants(memoryId, row.ref.id, row.blobs);
      refs.push(row.ref);
      continue;
    }
    if (isMemoryPhotoRef(row)) {
      refs.push(row);
      continue;
    }
    if (photoRowHasInlineDataUrl(row)) {
      const migrated = await migrateInlinePhotosToRefs(memoryId, [row]);
      if (migrated[0]) refs.push(migrated[0]);
    }
  }

  const nextIds = new Set(refs.map((ref) => ref.id));
  const removed = previousPhotoIds.filter((id) => !nextIds.has(id));
  if (removed.length) await deletePhotoBlobsForPhotoIds(removed);

  return refs.length ? refs : null;
}

async function readPreviousPhotoIds(memoryId: string): Promise<string[]> {
  try {
    return await listPhotoIdsForMemory(memoryId);
  } catch {
    return [];
  }
}

async function touchOomRiskSnapshot(): Promise<void> {
  try {
    setCachedMemoryCount(await getMemoryCount());
  } catch {
    /* best-effort */
  }
}

async function readPreviousPhotoIdsFromRecord(
  record: MemoryDbRecord | null
): Promise<string[]> {
  if (!record) return [];
  try {
    const photos = await localCrypto.decryptJson(record.photoEnc);
    const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
    return rows
      .map((row) =>
        row && typeof row === "object" ? String((row as MemoryPhotoRef).id || "") : ""
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeMemoryInput(input: MemoryUpsertPayload = {}) {
  const now = Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    title: input.title ?? "",
    story: input.story ?? "",
    photo: input.photo ?? null,
    voice: input.voice ?? null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    timelineAt: input.timelineAt ?? now,
    releaseAt: Number(input.releaseAt || 0) || 0,
    tags: Array.isArray(input.tags) ? input.tags : [],
    encryptVoice: input.encryptVoice !== false,
    is_sealed: Boolean(input.is_sealed),
    coreLocked: Boolean(input.coreLocked),
    pairShared: Boolean(input.pairShared),
    locallySealedAt: Number(input.locallySealedAt || 0) || undefined,
    serverSealedAt: Number(input.serverSealedAt || 0) || undefined,
    ring_id: input.ring_id ?? null,
    haven_id: input.haven_id ?? null,
    createdByUserId: input.createdByUserId ?? null,
    fromPartner: Boolean(input.fromPartner),
    supplements:
      input.supplements !== undefined
        ? mergeSupplements([], input.supplements)
        : [],
  };
}

function toRecord(
  memory: ReturnType<typeof normalizeMemoryInput>,
  encrypted: Awaited<ReturnType<typeof encryptMemoryFields>>
): MemoryDbRecord {
  return {
    id: memory.id,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    timelineAt: memory.timelineAt,
    title: memory.title,
    tags: memory.tags,
    storyEnc: encrypted.storyEnc,
    photoEnc: encrypted.photoEnc,
    voiceEnc: encrypted.voiceEnc,
    voicePlain: encrypted.voicePlain,
    attachmentsEnc: encrypted.attachmentsEnc,
    metaEnc: encrypted.metaEnc,
  };
}

async function encryptMemoryFields(memory: ReturnType<typeof normalizeMemoryInput>) {
  const metaPayload = {
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    timelineAt: memory.timelineAt,
    releaseAt: memory.releaseAt,
    tags: memory.tags,
    is_sealed: memory.is_sealed,
    coreLocked: memory.coreLocked,
    pairShared: memory.pairShared,
    locallySealedAt: memory.locallySealedAt,
    serverSealedAt: memory.serverSealedAt,
    ring_id: memory.ring_id,
    haven_id: memory.haven_id,
    createdByUserId: memory.createdByUserId,
    fromPartner: memory.fromPartner,
    supplements: memory.supplements ?? [],
    hasPhotos: (() => {
      const raw = memory.photo;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return list.length > 0;
    })(),
    photoCount: (() => {
      const raw = memory.photo;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      return list.length;
    })(),
    hasLargePhotos: photoPayloadHasLargeBlob(memory.photo),
  };

  if (isMobileMemorySensitive()) {
    const storyEnc = await localCrypto.encryptValue(memory.story || "");
    const photoEnc = await localCrypto.encryptJson(memory.photo);
    const attachmentsEnc = await localCrypto.encryptJson(memory.attachments || []);
    const metaEnc = await localCrypto.encryptJson(metaPayload);
    if (memory.encryptVoice) {
      const voiceEnc = await localCrypto.encryptJson(memory.voice);
      return {
        storyEnc,
        photoEnc,
        voiceEnc,
        voicePlain: null,
        attachmentsEnc,
        metaEnc,
      };
    }
    return {
      storyEnc,
      photoEnc,
      voiceEnc: null,
      voicePlain: memory.voice,
      attachmentsEnc,
      metaEnc,
    };
  }

  const [storyEnc, photoEnc, attachmentsEnc, metaEnc] = await Promise.all([
    localCrypto.encryptValue(memory.story || ""),
    localCrypto.encryptJson(memory.photo),
    localCrypto.encryptJson(memory.attachments || []),
    localCrypto.encryptJson(metaPayload),
  ]);

  if (memory.encryptVoice) {
    const voiceEnc = await localCrypto.encryptJson(memory.voice);
    return {
      storyEnc,
      photoEnc,
      voiceEnc,
      voicePlain: null,
      attachmentsEnc,
      metaEnc,
    };
  }

  return {
    storyEnc,
    photoEnc,
    voiceEnc: null,
    voicePlain: memory.voice,
    attachmentsEnc,
    metaEnc,
  };
}

async function decryptRecordSummary(record: MemoryDbRecord): Promise<TimelineMemorySummary> {
  const [story, meta] = await Promise.all([
    localCrypto.decryptValue(record.storyEnc),
    localCrypto.decryptJson(record.metaEnc),
  ]);
  const metaObj = meta as Record<string, unknown>;
  const photoCount = Number(metaObj.photoCount || 0);
  const hasPhotos =
    typeof metaObj.hasPhotos === "boolean"
      ? Boolean(metaObj.hasPhotos)
      : photoCount > 0;
  const previewMax = getTimelineStoryPreviewMaxChars();
  const storyPreview =
    story.length > previewMax ? `${story.slice(0, previewMax).trim()}…` : story;

  const metaSupplements = Array.isArray(metaObj.supplements)
    ? (metaObj.supplements as MemorySupplement[])
    : [];

  return {
    id: record.id,
    title: record.title || "",
    story: "",
    storyPreview,
    photo: null,
    voice: null,
    attachments: [],
    createdAt: Number(metaObj.createdAt ?? record.createdAt),
    updatedAt: Number(metaObj.updatedAt ?? record.updatedAt),
    timelineAt: Number(metaObj.timelineAt ?? record.timelineAt),
    releaseAt: Number(metaObj.releaseAt || 0) || 0,
    tags: Array.isArray(metaObj.tags) ? metaObj.tags : [],
    is_sealed: Boolean(metaObj.is_sealed),
    coreLocked: Boolean(metaObj.coreLocked),
    pairShared: Boolean(metaObj.pairShared),
    ring_id: (metaObj.ring_id as string | null) ?? null,
    haven_id: (metaObj.haven_id as string | null) ?? null,
    createdByUserId: (metaObj.createdByUserId as string | null) ?? null,
    fromPartner: Boolean(metaObj.fromPartner),
    supplements: await resolveMemorySupplements(record.id, metaSupplements),
    hasPhotos,
    hasLargePhotos: Boolean(metaObj.hasLargePhotos),
  };
}

function firstPhotoDataUrlFromEncrypted(photo: unknown): string | null {
  return firstPhotoDataUrl(photo);
}

async function decryptSummariesForTimeline(
  records: MemoryDbRecord[]
): Promise<TimelineMemorySummary[]> {
  if (!records.length) return [];
  if (isMobileMemorySensitive()) {
    const items: TimelineMemorySummary[] = [];
    for (const row of records) {
      items.push(await decryptRecordSummary(row));
    }
    return items;
  }
  return Promise.all(records.map((row) => decryptRecordSummary(row)));
}

async function resolveTimelineThumbFromPhotoRef(
  photoId: string,
  memoryId: string,
  updatedAt: number
): Promise<Blob | null> {
  const existing = await getPhotoBlob(photoId, "thumb");
  if (existing) return existing;

  const full = await getPhotoBlob(photoId, "full");
  if (!full || typeof URL === "undefined") return null;

  const previewUrl = URL.createObjectURL(full);
  try {
    const generated = await dataUrlToTimelineThumbBlob(previewUrl);
    if (generated) {
      const medium = (await getPhotoBlob(photoId, "medium")) ?? generated;
      void writePersistedTimelineMedia(memoryId, updatedAt, generated, medium);
    }
    return generated;
  } finally {
    URL.revokeObjectURL(previewUrl);
  }
}

async function scheduleTimelineThumbWarm(
  memoryId: string,
  memoryUpdatedAt: number,
  photo: unknown
): Promise<void> {
  if (isPostSealQuietWindow()) return;
  if (isIosWebKit() && photoPayloadHasLargeBlob(photo)) return;
  const ref = firstPhotoRef(photo);
  if (ref?.id) {
    try {
      const thumb = await resolveTimelineThumbFromPhotoRef(ref.id, memoryId, memoryUpdatedAt);
      if (!thumb) return;
      const medium = (await getPhotoBlob(ref.id, "medium")) ?? thumb;
      await writePersistedTimelineMedia(memoryId, memoryUpdatedAt, thumb, medium);
    } catch {
      /* best-effort blob-ref warm */
    }
    return;
  }
  const dataUrl = firstPhotoDataUrlFromEncrypted(photo);
  if (!dataUrl) return;
  if (isIosWebKit() && photoPayloadHasLargeBlob(photo)) return;
  try {
    await warmTimelineMediaFromDataUrl(memoryId, memoryUpdatedAt, dataUrl);
  } catch {
    /* best-effort legacy inline warm */
  }
}

async function readRecordsByTimelineDesc(
  db: IDBDatabase,
  limit: number,
  beforeTimelineAt?: number | null
): Promise<MemoryDbRecord[]> {
  return new Promise((resolve, reject) => {
    const records: MemoryDbRecord[] = [];
    const tx = db.transaction(STORE_MEMORIES, "readonly");
    const index = tx.objectStore(STORE_MEMORIES).index("timelineAt");
    const range =
      beforeTimelineAt != null
        ? IDBKeyRange.upperBound(beforeTimelineAt, true)
        : undefined;
    const req = index.openCursor(range, "prev");
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor || records.length >= limit) {
        resolve(records);
        return;
      }
      records.push(cursor.value as MemoryDbRecord);
      cursor.continue();
    };
    req.onerror = () => reject(req.error ?? new Error("Failed to read timeline cursor."));
  });
}

/**
 * Paginated timeline feed — decrypts story/meta only (no photo blobs).
 */
export async function getTimelineMemorySummaries(opts: {
  limit: number;
  beforeTimelineAt?: number | null;
}): Promise<TimelineMemoryPage> {
  scheduleLegacyPhotoBlobMigration();
  const limit = Math.max(1, Math.min(50, opts.limit || 25));
  const db = await openDb();
  try {
    const records = await readRecordsByTimelineDesc(db, limit, opts.beforeTimelineAt);
    const items = await decryptSummariesForTimeline(records);
    const last = records[records.length - 1];
    const hasMore = records.length === limit;
    return {
      items,
      hasMore,
      nextBeforeTimelineAt: hasMore && last ? last.timelineAt : null,
    };
  } finally {
    db.close();
  }
}

/** Gentle warning when device storage is nearly full (local-first). */
export async function warnIfLocalStorageTight(): Promise<string | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    const usage = Number(est.usage || 0);
    const quota = Number(est.quota || 0);
    const ratio = quota ? usage / quota : 0;
    if (!quota || ratio < 0.85) return null;
    if (typeof console !== "undefined") {
      console.log("[haven-ring] local storage tight", {
        usageMb: Math.round(usage / (1024 * 1024)),
        quotaMb: Math.round(quota / (1024 * 1024)),
        headroomMb: Math.round((quota - usage) / (1024 * 1024)),
        usageRatio: Math.round(ratio * 1000) / 1000,
      });
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(STORAGE_KEYS.localStorageQuotaWarn, "1");
    }
    return "Local storage is getting full — consider removing older memories.";
  } catch {
    return null;
  }
}

export function readLocalStorageQuotaWarnFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEYS.localStorageQuotaWarn) === "1";
  } catch {
    return false;
  }
}

/** Lazy media — thumb JPEG blob from photoBlobs store (legacy inline fallback). */
export async function getTimelineMemoryThumbBlob(memoryId: string): Promise<Blob | null> {
  if (!memoryId) return null;
  return runTimelineDecodeTask(async () => {
    const db = await openDb();
    try {
      const record = await new Promise<MemoryDbRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readonly");
        const req = tx.objectStore(STORE_MEMORIES).get(memoryId);
        req.onsuccess = () => resolve((req.result ?? null) as MemoryDbRecord | null);
        req.onerror = () =>
          reject(req.error ?? new Error("Failed to read memory by id."));
      });
      if (!record) return null;

      const meta = await localCrypto.decryptJson(record.metaEnc);
      const metaObj = meta as Record<string, unknown>;
      const updatedAt = Number(metaObj.updatedAt ?? record.updatedAt);
      const hasLargePhotos = Boolean(metaObj.hasLargePhotos);

      const cached = await readPersistedTimelineMedia(memoryId, updatedAt, "thumb");
      if (cached) return cached;

      if (hasLargePhotos && isPostSealQuietWindow()) {
        return null;
      }

      const photo = await localCrypto.decryptJson(record.photoEnc);
      const ref = firstPhotoRef(photo);
      if (ref?.id) {
        const blob = await resolveTimelineThumbFromPhotoRef(ref.id, memoryId, updatedAt);
        if (blob) return blob;
      }

      if (isIosWebKit() && hasLargePhotos) return null;

      const dataUrl = firstPhotoDataUrlFromEncrypted(photo);
      if (!dataUrl) return null;

      const { thumb, medium } = await dataUrlToTimelineMediaBlobs(dataUrl);
      if (thumb && medium) {
        void writePersistedTimelineMedia(memoryId, updatedAt, thumb, medium);
      }
      return thumb;
    } finally {
      db.close();
    }
  });
}

/** Medium preview blob (800px) — photoBlobs first, legacy inline fallback. */
export async function getTimelineMemoryMediumBlob(memoryId: string): Promise<Blob | null> {
  if (!memoryId) return null;
  return runTimelineDecodeTask(async () => {
    const db = await openDb();
    try {
      const record = await new Promise<MemoryDbRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_MEMORIES, "readonly");
        const req = tx.objectStore(STORE_MEMORIES).get(memoryId);
        req.onsuccess = () => resolve((req.result ?? null) as MemoryDbRecord | null);
        req.onerror = () =>
          reject(req.error ?? new Error("Failed to read memory by id."));
      });
      if (!record) return null;

      const meta = await localCrypto.decryptJson(record.metaEnc);
      const metaObj = meta as Record<string, unknown>;
      const updatedAt = Number(metaObj.updatedAt ?? record.updatedAt);

      const cached = await readPersistedTimelineMedia(memoryId, updatedAt, "medium");
      if (cached) return cached;

      const photo = await localCrypto.decryptJson(record.photoEnc);
      const ref = firstPhotoRef(photo);
      if (ref?.id) {
        const blob = await getPhotoBlob(ref.id, "medium");
        if (blob) return blob;
      }

      const dataUrl = firstPhotoDataUrlFromEncrypted(photo);
      if (!dataUrl) return null;

      const { thumb, medium } = await dataUrlToTimelineMediaBlobs(dataUrl);
      if (thumb && medium) {
        await writePersistedTimelineMedia(memoryId, updatedAt, thumb, medium);
        return medium;
      }
      return null;
    } finally {
      db.close();
    }
  });
}

/** Detail view — load one photo variant from photoBlobs (no base64 in heap). */
export async function getMemoryPhotoBlob(
  photoId: string,
  type: PhotoBlobType = "full"
): Promise<Blob | null> {
  if (!photoId) return null;
  return getPhotoBlob(photoId, type);
}

/** @deprecated Prefer getTimelineMemoryThumbBlob — avoids keeping data URLs in heap. */
export async function getTimelineMemoryThumbnail(memoryId: string): Promise<string | null> {
  const blob = await getTimelineMemoryThumbBlob(memoryId);
  if (!blob || typeof URL === "undefined") return null;
  return URL.createObjectURL(blob);
}

/** Search across all memories (text fields only — no photo decrypt). */
export async function searchTimelineMemorySummaries(query: string): Promise<TimelineMemorySummary[]> {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const db = await openDb();
  try {
    const records = await new Promise<MemoryDbRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).getAll();
      req.onsuccess = () => resolve((req.result || []) as MemoryDbRecord[]);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memories."));
    });
    const matched: TimelineMemorySummary[] = [];
    for (const row of records) {
      const story = await localCrypto.decryptValue(row.storyEnc);
      const title = String(row.title || "").toLowerCase();
      const storyLower = String(story || "").toLowerCase();
      const d = new Date(row.timelineAt).toLocaleString().toLowerCase();
      if (!title.includes(q) && !storyLower.includes(q) && !d.includes(q)) continue;
      matched.push(await decryptRecordSummary(row));
    }
    return matched.sort((a, b) => b.timelineAt - a.timelineAt);
  } finally {
    db.close();
  }
}

async function decryptRecord(record: MemoryDbRecord): Promise<LocalMemory> {
  const [story, photo, meta] = await Promise.all([
    localCrypto.decryptValue(record.storyEnc),
    localCrypto.decryptJson(record.photoEnc),
    localCrypto.decryptJson(record.metaEnc),
  ]);
  const attachments = record.attachmentsEnc
    ? await localCrypto.decryptJson(record.attachmentsEnc)
    : [];

  const voiceRaw =
    record.voiceEnc != null
      ? await localCrypto.decryptJson(record.voiceEnc)
      : record.voicePlain ?? null;

  const metaObj = meta as Record<string, unknown>;
  const metaSupplements = Array.isArray(metaObj.supplements)
    ? (metaObj.supplements as MemorySupplement[])
    : [];

  return {
    id: record.id,
    title: record.title || "",
    story,
    photo,
    voice: voiceRaw,
    attachments: Array.isArray(attachments) ? attachments : [],
    createdAt: Number(metaObj.createdAt ?? record.createdAt),
    updatedAt: Number(metaObj.updatedAt ?? record.updatedAt),
    timelineAt: Number(metaObj.timelineAt ?? record.timelineAt),
    releaseAt: Number(metaObj.releaseAt || 0) || 0,
    tags: Array.isArray(metaObj.tags) ? metaObj.tags : [],
    is_sealed: Boolean(metaObj.is_sealed),
    coreLocked: Boolean(metaObj.coreLocked),
    pairShared: Boolean(metaObj.pairShared),
    locallySealedAt: Number(metaObj.locallySealedAt || 0) || undefined,
    serverSealedAt: Number(metaObj.serverSealedAt || 0) || undefined,
    ring_id: (metaObj.ring_id as string | null) ?? null,
    haven_id: (metaObj.haven_id as string | null) ?? null,
    createdByUserId: (metaObj.createdByUserId as string | null) ?? null,
    fromPartner: Boolean(metaObj.fromPartner),
    supplements: await resolveMemorySupplements(record.id, metaSupplements),
  };
}

export async function createMemory(
  input?: MemoryUpsertPayload
): Promise<MemoryCreatedMeta> {
  const memory = normalizeMemoryInput(input ?? {});
  const photoRefs = await persistPhotoInputs(memory.id, memory.photo);
  memory.photo = photoRefs;
  const encrypted = await encryptMemoryFields(memory);
  const record = toRecord(memory, encrypted);

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).add(record);
    await txDone(tx);
    void writeSupplementsForMemory(memory.id, memory.supplements ?? []);
    void scheduleTimelineThumbWarm(memory.id, memory.updatedAt, memory.photo);
    scheduleLegacyPhotoBlobMigration();
    void touchOomRiskSnapshot();
    logStorageEstimate("createMemory");
    void warnIfLocalStorageTight();
    return {
      id: memory.id,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  } finally {
    db.close();
  }
}

export async function saveMemory(
  input: MemoryUpsertPayload,
  opts: MemorySaveOptions = {}
): Promise<MemorySavedMeta> {
  let merged = input;
  if (input.id) {
    const existing = await getMemoryById(input.id);
    const mergedSupplements = mergeSupplements(
      existing?.supplements,
      input.supplements
    );
    if (existing) {
      if (!opts.allowCoreEdit && existing.coreLocked) {
        merged = {
          ...existing,
          supplements: mergedSupplements,
          updatedAt: Date.now(),
        };
      } else if (opts.allowCoreEdit) {
        merged = {
          ...input,
          supplements: mergedSupplements,
        };
      } else {
        merged = {
          ...input,
          supplements: mergedSupplements,
        };
      }
    } else if (input.supplements !== undefined) {
      merged = {
        ...input,
        supplements: mergedSupplements,
      };
    }
  }
  const memory = normalizeMemoryInput(merged);
  const db = await openDb();
  let previousPhotoIds: string[] = [];
  try {
    const existingRecord = memory.id
      ? await new Promise<MemoryDbRecord | null>((resolve, reject) => {
          const tx = db.transaction(STORE_MEMORIES, "readonly");
          const req = tx.objectStore(STORE_MEMORIES).get(memory.id);
          req.onsuccess = () => resolve((req.result ?? null) as MemoryDbRecord | null);
          req.onerror = () =>
            reject(req.error ?? new Error("Failed to read memory by id."));
        })
      : null;
    previousPhotoIds = await readPreviousPhotoIdsFromRecord(existingRecord);
  } catch {
    previousPhotoIds = await readPreviousPhotoIds(memory.id);
  }

  if (merged.photo !== undefined) {
    const photoRefs = await persistPhotoInputs(memory.id, memory.photo, previousPhotoIds);
    memory.photo = photoRefs;
  }

  const encrypted = await encryptMemoryFields(memory);
  const record = toRecord(memory, encrypted);

  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).put(record);
    await txDone(tx);
    void writeSupplementsForMemory(memory.id, memory.supplements ?? []);
    void scheduleTimelineThumbWarm(memory.id, memory.updatedAt, memory.photo);
    scheduleLegacyPhotoBlobMigration();
    void touchOomRiskSnapshot();
    logStorageEstimate("saveMemory");
    void warnIfLocalStorageTight();
    const savedPhoto = memory.photo;
    if (photoPayloadHasLargeBlob(savedPhoto)) {
      markPostSealComplete({ hasLargeMedia: true });
    }
    return { id: memory.id, updatedAt: memory.updatedAt };
  } finally {
    db.close();
  }
}

export async function getMemoryCount(): Promise<number> {
  const db = await openDb();
  try {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).count();
      req.onsuccess = () => resolve(Number(req.result || 0));
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to count memories."));
    });
  } finally {
    db.close();
  }
}

export async function getAllMemories(): Promise<LocalMemory[]> {
  const db = await openDb();
  try {
    const records = await new Promise<MemoryDbRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).getAll();
      req.onsuccess = () => resolve((req.result || []) as MemoryDbRecord[]);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memories."));
    });

    const decrypted = await Promise.all(records.map((r) => decryptRecord(r)));
    return decrypted.sort((a, b) => b.timelineAt - a.timelineAt);
  } finally {
    db.close();
  }
}

export async function getMemoryById(id: string): Promise<LocalMemory | null> {
  if (!id) return null;
  const db = await openDb();
  try {
    const record = await new Promise<MemoryDbRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).get(id);
      req.onsuccess = () => resolve((req.result ?? null) as MemoryDbRecord | null);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memory by id."));
    });

    if (!record) return null;
    return decryptRecord(record);
  } finally {
    db.close();
  }
}

export async function appendMemorySupplement(
  id: string,
  text: string,
  authorUserId?: string | null
): Promise<MemorySavedMeta> {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Add a few words for your note.");
  }
  const existing = await getMemoryById(id);
  if (!existing) {
    throw new Error("Memory not found.");
  }
  if (!existing.coreLocked && !existing.is_sealed) {
    throw new Error("Only sealed memories accept append notes.");
  }
  const supplements = mergeSupplements(existing.supplements, [
    {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: Date.now(),
      authorUserId: authorUserId || null,
    },
  ]);
  return saveMemory({ ...existing, supplements });
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (!id) return false;
  await deletePhotoBlobsForMemory(id);
  await deleteSupplementsForMemory(id);
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).delete(id);
    await txDone(tx);
    await deletePersistedTimelineThumb(id);
    void touchOomRiskSnapshot();
    return true;
  } finally {
    db.close();
  }
}

export async function clearAllMemories(): Promise<boolean> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).clear();
    await txDone(tx);
    await clearAllPersistedTimelineThumbs();
    await clearAllMemorySupplements();
  } finally {
    db.close();
  }
  const blobDb = await openDb();
  try {
    const tx = blobDb.transaction(STORE_PHOTO_BLOBS, "readwrite");
    tx.objectStore(STORE_PHOTO_BLOBS).clear();
    await txDone(tx);
    return true;
  } finally {
    blobDb.close();
  }
}

/** Repository-style alias for callers that prefer OO naming. */
export const memoryRepository = {
  /** Insert new encrypted memory row; fails if id already exists. */
  insert: createMemory,
  upsert: saveMemory,
  listAll: getAllMemories,
  findById: getMemoryById,
  deleteById: deleteMemory,
  clearAll: clearAllMemories,
} as const;

export type MemoryRepository = typeof memoryRepository;
