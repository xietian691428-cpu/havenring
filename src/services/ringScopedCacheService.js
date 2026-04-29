/**
 * IndexedDB cache partitioned by ring UID fingerprint (local prefix).
 * Offline writes land here first; sync reconciles with cloud + content_sha256.
 */
import { createStore, del, entries, get, set } from "idb-keyval";

const DB = "haven-ring-scoped-cache-v1";
const SYNC_QUEUE_KEY = "sync:queue";
const CLOUD_SNAPSHOT_KEY = "cloud:snapshot";

function normalizeStoreName(uidHashPrefix) {
  return String(uidHashPrefix || "default").slice(0, 32);
}

function storeForUidHash(uidHashPrefix) {
  return createStore(DB, normalizeStoreName(uidHashPrefix));
}

export async function putRingDraft(uidHashPrefix, key, value) {
  const st = storeForUidHash(uidHashPrefix);
  await set(`draft:${key}`, value, st);
}

export async function getRingDraft(uidHashPrefix, key) {
  const st = storeForUidHash(uidHashPrefix);
  return get(`draft:${key}`, st);
}

export async function deleteRingDraft(uidHashPrefix, key) {
  const st = storeForUidHash(uidHashPrefix);
  await del(`draft:${key}`, st);
}

export async function listRingDrafts(uidHashPrefix) {
  const st = storeForUidHash(uidHashPrefix);
  const all = await entries(st);
  return all
    .filter(([k]) => String(k).startsWith("draft:"))
    .map(([key, value]) => ({
      key: String(key).slice("draft:".length),
      value,
    }));
}

export async function enqueueRingSync(uidHashPrefix, item) {
  const st = storeForUidHash(uidHashPrefix);
  const queue = (await get(SYNC_QUEUE_KEY, st)) || [];
  const next = [
    ...queue.filter((row) => row?.id !== item?.id),
    {
      ...item,
      queuedAt: Date.now(),
    },
  ];
  await set(SYNC_QUEUE_KEY, next, st);
  return next.length;
}

export async function readRingSyncQueue(uidHashPrefix) {
  const st = storeForUidHash(uidHashPrefix);
  return (await get(SYNC_QUEUE_KEY, st)) || [];
}

export async function clearRingSyncQueue(uidHashPrefix, syncedIds = []) {
  const st = storeForUidHash(uidHashPrefix);
  const queue = (await get(SYNC_QUEUE_KEY, st)) || [];
  const next = queue.filter((row) => !syncedIds.includes(row?.id));
  await set(SYNC_QUEUE_KEY, next, st);
  return next.length;
}

export async function writeCloudSnapshot(uidHashPrefix, rows) {
  const st = storeForUidHash(uidHashPrefix);
  await set(CLOUD_SNAPSHOT_KEY, Array.isArray(rows) ? rows : [], st);
}

export async function readCloudSnapshot(uidHashPrefix) {
  const st = storeForUidHash(uidHashPrefix);
  return (await get(CLOUD_SNAPSHOT_KEY, st)) || [];
}
