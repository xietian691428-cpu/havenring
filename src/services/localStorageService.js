/**
 * Haven Ring - Local Memory Storage Service
 *
 * Offline-first IndexedDB storage for memories.
 * Sensitive content is encrypted locally before persistence.
 *
 * Privacy statement:
 * "Your content is encrypted and stored locally on your device."
 */

import {
  decryptJson,
  decryptValue,
  encryptJson,
  encryptValue,
} from "./encryptionService";

const DB_NAME = "haven_ring_memories_db";
const DB_VERSION = 1;
const STORE_MEMORIES = "memories";

/**
 * Memory input contract.
 * photo and story are encrypted by default.
 * attachments are encrypted alongside story/photo content.
 */
function normalizeMemoryInput(input = {}) {
  const now = Date.now();
  return {
    id: input.id || crypto.randomUUID(),
    createdAt: input.createdAt || now,
    updatedAt: now,
    title: input.title || "",
    story: input.story || "",
    photo: input.photo || null, // e.g. data URL or binary metadata object
    voice: input.voice || null, // legacy field kept for backward compatibility
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    timelineAt: input.timelineAt || now,
    releaseAt: Number(input.releaseAt || 0) || 0,
    tags: Array.isArray(input.tags) ? input.tags : [],
    encryptVoice: input.encryptVoice !== false,
  };
}

function openDb() {
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
    req.onerror = () => reject(req.error || new Error("Failed to open memory database."));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

function toRecord(memory, encrypted) {
  return {
    id: memory.id,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    timelineAt: memory.timelineAt,
    title: memory.title,
    tags: memory.tags,
    // encrypted payloads
    storyEnc: encrypted.storyEnc,
    photoEnc: encrypted.photoEnc,
    voiceEnc: encrypted.voiceEnc,
    voicePlain: encrypted.voicePlain,
    attachmentsEnc: encrypted.attachmentsEnc,
    metaEnc: encrypted.metaEnc,
  };
}

async function encryptMemoryFields(memory) {
  const [storyEnc, photoEnc, attachmentsEnc, metaEnc] = await Promise.all([
    encryptValue(memory.story || ""),
    encryptJson(memory.photo),
    encryptJson(memory.attachments || []),
    encryptJson({
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      timelineAt: memory.timelineAt,
      releaseAt: memory.releaseAt,
      tags: memory.tags,
    }),
  ]);

  if (memory.encryptVoice) {
    const voiceEnc = await encryptJson(memory.voice);
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

async function decryptRecord(record) {
  const [story, photo, meta] = await Promise.all([
    decryptValue(record.storyEnc),
    decryptJson(record.photoEnc),
    decryptJson(record.metaEnc),
  ]);
  const attachments = record.attachmentsEnc
    ? await decryptJson(record.attachmentsEnc)
    : [];

  const voice =
    record.voiceEnc != null ? await decryptJson(record.voiceEnc) : record.voicePlain ?? null;

  return {
    id: record.id,
    title: record.title || "",
    story,
    photo,
    voice,
    attachments: Array.isArray(attachments) ? attachments : [],
    createdAt: meta.createdAt ?? record.createdAt,
    updatedAt: meta.updatedAt ?? record.updatedAt,
    timelineAt: meta.timelineAt ?? record.timelineAt,
    releaseAt: Number(meta.releaseAt || 0) || 0,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
  };
}

/**
 * Create and persist one memory entry.
 */
export async function createMemory(input) {
  const memory = normalizeMemoryInput(input);
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

/**
 * Upsert memory by id (create if absent, update if existing).
 */
export async function saveMemory(input) {
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

/**
 * Return all memories sorted by timeline descending.
 */
export async function getAllMemories() {
  const db = await openDb();
  try {
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("Failed to read memories."));
    });

    const decrypted = await Promise.all(records.map((record) => decryptRecord(record)));
    return decrypted.sort((a, b) => b.timelineAt - a.timelineAt);
  } finally {
    db.close();
  }
}

/**
 * Fetch one memory by id.
 */
export async function getMemoryById(id) {
  if (!id) return null;
  const db = await openDb();
  try {
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORIES, "readonly");
      const req = tx.objectStore(STORE_MEMORIES).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("Failed to read memory by id."));
    });

    if (!record) return null;
    return decryptRecord(record);
  } finally {
    db.close();
  }
}

/**
 * Delete one memory by id.
 */
export async function deleteMemory(id) {
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

/**
 * Optional utility: clear all local memory records.
 */
export async function clearAllMemories() {
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
