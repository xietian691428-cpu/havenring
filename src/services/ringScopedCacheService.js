/**
 * IndexedDB cache partitioned by ring UID fingerprint (local prefix).
 * Offline writes land here first; sync reconciles with cloud + content_sha256.
 *
 * Uses one object store + key prefixes — NOT one store per ring. iOS Safari
 * cannot add new object stores to an existing DB without a version bump; the
 * old per-ring store pattern caused "object store was not found" for partner B.
 */
import { createStore, del, entries, get, set } from "idb-keyval";

const DB = "haven-ring-scoped-cache-v2";
const STORE_NAME = "entries";
const SYNC_QUEUE_KEY = "sync:queue";
const CLOUD_SNAPSHOT_KEY = "cloud:snapshot";

const store = createStore(DB, STORE_NAME);

function normalizeStoreName(uidHashPrefix) {
  return String(uidHashPrefix || "default").slice(0, 32);
}

function scopedKey(uidHashPrefix, key) {
  return `${normalizeStoreName(uidHashPrefix)}:${key}`;
}

export async function putRingDraft(uidHashPrefix, key, value) {
  await set(scopedKey(uidHashPrefix, `draft:${key}`), value, store);
}

export async function getRingDraft(uidHashPrefix, key) {
  return get(scopedKey(uidHashPrefix, `draft:${key}`), store);
}

export async function deleteRingDraft(uidHashPrefix, key) {
  await del(scopedKey(uidHashPrefix, `draft:${key}`), store);
}

export async function listRingDrafts(uidHashPrefix) {
  const prefix = `${normalizeStoreName(uidHashPrefix)}:draft:`;
  const all = await entries(store);
  return all
    .filter(([k]) => String(k).startsWith(prefix))
    .map(([key, value]) => ({
      key: String(key).slice(prefix.length),
      value,
    }));
}

export async function enqueueRingSync(uidHashPrefix, item) {
  const queueKey = scopedKey(uidHashPrefix, SYNC_QUEUE_KEY);
  const queue = (await get(queueKey, store)) || [];
  const next = [
    ...queue.filter((row) => row?.id !== item?.id),
    {
      ...item,
      queuedAt: Date.now(),
    },
  ];
  await set(queueKey, next, store);
  return next.length;
}

export async function readRingSyncQueue(uidHashPrefix) {
  return (await get(scopedKey(uidHashPrefix, SYNC_QUEUE_KEY), store)) || [];
}

export async function clearRingSyncQueue(uidHashPrefix, syncedIds = []) {
  const queueKey = scopedKey(uidHashPrefix, SYNC_QUEUE_KEY);
  const queue = (await get(queueKey, store)) || [];
  const next = queue.filter((row) => !syncedIds.includes(row?.id));
  await set(queueKey, next, store);
  return next.length;
}

export async function writeCloudSnapshot(uidHashPrefix, rows) {
  await set(
    scopedKey(uidHashPrefix, CLOUD_SNAPSHOT_KEY),
    Array.isArray(rows) ? rows : [],
    store
  );
}

export async function readCloudSnapshot(uidHashPrefix) {
  return (await get(scopedKey(uidHashPrefix, CLOUD_SNAPSHOT_KEY), store)) || [];
}
