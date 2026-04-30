import { createStore, del, entries, get, set } from "idb-keyval";

const DB_NAME = "haven-draft-box-v1";
const STORE_NAME = "drafts";
const DRAFT_PREFIX = "draft:";

const store = createStore(DB_NAME, STORE_NAME);

export async function saveDraftItem(input) {
  const id = String(input?.id || crypto.randomUUID());
  const now = Date.now();
  const item = {
    id,
    title: String(input?.title || ""),
    story: String(input?.story || ""),
    photo: Array.isArray(input?.photo) ? input.photo : [],
    attachments: Array.isArray(input?.attachments) ? input.attachments : [],
    releaseAt: Number(input?.releaseAt || 0) || 0,
    updatedAt: now,
    createdAt: Number(input?.createdAt || now),
  };
  await set(`${DRAFT_PREFIX}${id}`, item, store);
  return item;
}

export async function listDraftItems() {
  const all = await entries(store);
  return all
    .filter(([key]) => String(key).startsWith(DRAFT_PREFIX))
    .map(([, value]) => value)
    .sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
}

export async function getDraftItem(id) {
  if (!id) return null;
  return (await get(`${DRAFT_PREFIX}${id}`, store)) || null;
}

export async function removeDraftItem(id) {
  if (!id) return;
  await del(`${DRAFT_PREFIX}${id}`, store);
}
