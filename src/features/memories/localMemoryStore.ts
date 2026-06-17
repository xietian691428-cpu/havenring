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
import { getTimelineStoryPreviewMaxChars } from "@/lib/timeline-ios-guard";
import {
  clearAllPersistedTimelineThumbs,
  deletePersistedTimelineThumb,
} from "@/lib/timeline-thumb-store";
import type { TimelineMemoryPage, TimelineMemorySummary } from "@/lib/timeline-memory-types";

/** User-facing decrypted memory shape (timeline / detail UI). */
export type MemorySupplement = {
  id: string;
  text: string;
  createdAt: number;
  authorUserId?: string | null;
};

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

const DB_NAME = "haven_ring_memories_db";
const DB_VERSION = 2;
const STORE_MEMORIES = "memories";

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
    ring_id: input.ring_id ?? null,
    haven_id: input.haven_id ?? null,
    createdByUserId: input.createdByUserId ?? null,
    fromPartner: Boolean(input.fromPartner),
    supplements: Array.isArray(input.supplements) ? input.supplements : [],
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("timelineAt", "timelineAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to open memory database."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
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
  const [storyEnc, photoEnc, attachmentsEnc, metaEnc] = await Promise.all([
    localCrypto.encryptValue(memory.story || ""),
    localCrypto.encryptJson(memory.photo),
    localCrypto.encryptJson(memory.attachments || []),
    localCrypto.encryptJson({
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      timelineAt: memory.timelineAt,
      releaseAt: memory.releaseAt,
      tags: memory.tags,
      is_sealed: memory.is_sealed,
      coreLocked: memory.coreLocked,
      pairShared: memory.pairShared,
      ring_id: memory.ring_id,
      haven_id: memory.haven_id,
      createdByUserId: memory.createdByUserId,
      fromPartner: memory.fromPartner,
      supplements: memory.supplements,
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
    }),
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

  return {
    id: record.id,
    title: record.title || "",
    story,
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
    supplements: Array.isArray(metaObj.supplements)
      ? (metaObj.supplements as MemorySupplement[])
      : [],
    hasPhotos,
  };
}

function firstPhotoDataUrl(photo: unknown): string | null {
  const raw = Array.isArray(photo) ? photo : photo ? [photo] : [];
  const first = raw[0];
  if (!first) return null;
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null) {
    const row = first as { dataUrl?: string; previewUrl?: string; src?: string; url?: string };
    return row.dataUrl || row.previewUrl || row.src || row.url || null;
  }
  return null;
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
  const limit = Math.max(1, Math.min(50, opts.limit || 25));
  const db = await openDb();
  try {
    const records = await readRecordsByTimelineDesc(db, limit, opts.beforeTimelineAt);
    const items = await Promise.all(records.map((row) => decryptRecordSummary(row)));
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

/** Lazy media — first photo data URL for one memory (viewport-driven). */
export async function getTimelineMemoryThumbnail(memoryId: string): Promise<string | null> {
  if (!memoryId) return null;
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
    const photo = await localCrypto.decryptJson(record.photoEnc);
    return firstPhotoDataUrl(photo);
  } finally {
    db.close();
  }
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
    const summaries = await Promise.all(records.map((row) => decryptRecordSummary(row)));
    return summaries
      .filter((row) => {
        const title = String(row.title || "").toLowerCase();
        const story = String(row.story || "").toLowerCase();
        const d = new Date(row.timelineAt).toLocaleString().toLowerCase();
        return title.includes(q) || story.includes(q) || d.includes(q);
      })
      .sort((a, b) => b.timelineAt - a.timelineAt);
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
    ring_id: (metaObj.ring_id as string | null) ?? null,
    haven_id: (metaObj.haven_id as string | null) ?? null,
    createdByUserId: (metaObj.createdByUserId as string | null) ?? null,
    fromPartner: Boolean(metaObj.fromPartner),
    supplements: Array.isArray(metaObj.supplements)
      ? (metaObj.supplements as MemorySupplement[])
      : [],
  };
}

export async function createMemory(
  input?: MemoryUpsertPayload
): Promise<MemoryCreatedMeta> {
  const memory = normalizeMemoryInput(input ?? {});
  const encrypted = await encryptMemoryFields(memory);
  const record = toRecord(memory, encrypted);

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).add(record);
    await txDone(tx);
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
  if (input.id && !opts.allowCoreEdit) {
    const existing = await getMemoryById(input.id);
    if (existing?.coreLocked) {
      merged = {
        ...existing,
        supplements: input.supplements ?? existing.supplements,
        updatedAt: Date.now(),
      };
    }
  }
  const memory = normalizeMemoryInput(merged);
  const encrypted = await encryptMemoryFields(memory);
  const record = toRecord(memory, encrypted);

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).put(record);
    await txDone(tx);
    return { id: memory.id, updatedAt: memory.updatedAt };
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
  const supplements = [
    ...(Array.isArray(existing.supplements) ? existing.supplements : []),
    {
      id: crypto.randomUUID(),
      text: trimmed,
      createdAt: Date.now(),
      authorUserId: authorUserId || null,
    },
  ];
  return saveMemory({ ...existing, supplements });
}

export async function deleteMemory(id: string): Promise<boolean> {
  if (!id) return false;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).delete(id);
    await txDone(tx);
    await deletePersistedTimelineThumb(id);
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
    return true;
  } finally {
    db.close();
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
