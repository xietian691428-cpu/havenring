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

/** User-facing decrypted memory shape (timeline / detail UI). */
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
};

export type MemoryUpsertPayload = Partial<LocalMemory> & {
  id?: string;
  /** When false-ish, legacy voice stored as plaintext in record (backward compat). */
  encryptVoice?: boolean;
};

export type MemoryCreatedMeta = Pick<LocalMemory, "id" | "createdAt" | "updatedAt">;

export type MemorySavedMeta = Pick<LocalMemory, "id" | "updatedAt">;

const DB_NAME = "haven_ring_memories_db";
const DB_VERSION = 1;
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

export async function saveMemory(input: MemoryUpsertPayload): Promise<MemorySavedMeta> {
  const memory = normalizeMemoryInput(input);
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

export async function deleteMemory(id: string): Promise<boolean> {
  if (!id) return false;
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_MEMORIES, "readwrite");
    tx.objectStore(STORE_MEMORIES).delete(id);
    await txDone(tx);
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
