/**
 * Seal / composer drafts (idb-keyval) — **plaintext** local-first store.
 * No network required. Long-term vault = {@link ./localMemoryStore} after Save Securely / seal finalize.
 *
 * Client orchestration: `src/features/seal/`.
 */

import { createStore, del, entries, get, set } from "idb-keyval";

const DB_NAME = "haven-draft-box-v1";
const STORE_NAME = "drafts";
const DRAFT_PREFIX = "draft:";

const store = createStore(DB_NAME, STORE_NAME);

export type DraftItem = {
  id: string;
  title: string;
  story: string;
  photo: unknown[];
  attachments: unknown[];
  releaseAt: number;
  updatedAt: number;
  createdAt: number;
};

export type DraftUpsertInput = Partial<DraftItem> & {
  id?: string;
};

export async function saveDraftItem(input: DraftUpsertInput = {}): Promise<DraftItem> {
  const id = String(input?.id || crypto.randomUUID());
  const now = Date.now();
  const item: DraftItem = {
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

export async function listDraftItems(): Promise<DraftItem[]> {
  const all = await entries(store);
  return all
    .filter(([key]) => String(key).startsWith(DRAFT_PREFIX))
    .map(([, value]) => value as DraftItem)
    .sort((a, b) => (b?.updatedAt || 0) - (a?.updatedAt || 0));
}

export async function getDraftItem(id: string): Promise<DraftItem | null> {
  if (!id) return null;
  return ((await get(`${DRAFT_PREFIX}${id}`, store)) as DraftItem | undefined) ?? null;
}

export async function removeDraftItem(id: string): Promise<void> {
  if (!id) return;
  await del(`${DRAFT_PREFIX}${id}`, store);
}

/** Repository-style alias aligned with `memoryRepository`. */
export const draftBoxRepository = {
  upsertDraft: saveDraftItem,
  listDrafts: listDraftItems,
  getDraft: getDraftItem,
  deleteDraft: removeDraftItem,
} as const;

export type DraftBoxRepository = typeof draftBoxRepository;
