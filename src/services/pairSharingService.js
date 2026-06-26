import { decodeServerMomentVault } from "@/lib/pair-sharing";
import { mergeSupplements } from "@/lib/memory-supplements";
import {
  countDisplayablePhotos,
  normalizeAttachmentsForStorage,
  normalizePhotosForStorage,
} from "@/lib/memory-photo-display";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createMemory,
  getMemoryById,
  saveMemory,
} from "./localStorageService";
import { isCloudBackupReady, backupMemoryToCloud } from "./cloudBackupService";

const IMPORT_CURSOR_KEY = "haven.pair.import_cursor.v1";

function readPairShareEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.pairShareEnabled);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export function isPairSharingEnabled() {
  return readPairShareEnabled();
}

export function setPairSharingEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.pairShareEnabled, enabled ? "1" : "0");
}

export function markPairSharePromptDone() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEYS.pairSharePromptDone, "1");
}

export function wasPairSharePromptDone() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEYS.pairSharePromptDone) === "1";
}

function readImportCursor() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(IMPORT_CURSOR_KEY) || "";
}

function writeImportCursor(iso) {
  if (typeof window === "undefined" || !iso) return;
  window.localStorage.setItem(IMPORT_CURSOR_KEY, iso);
}

function bundleToLocalPayload(bundle, currentUserId) {
  const draft = decodeServerMomentVault(bundle.encrypted_vault);
  if (!draft) return null;
  const createdAt = Date.parse(bundle.created_at || "") || Date.now();
  const ownedByYou = bundle.created_by_user_id === currentUserId;
  const photo = normalizePhotosForStorage(draft.photo);
  const attachments = normalizeAttachmentsForStorage(draft.attachments) || [];
  return {
    id: draft.id,
    title: draft.title || "Untitled memory",
    story: draft.story || "",
    photo,
    attachments,
    voice: null,
    timelineAt: createdAt,
    releaseAt: draft.releaseAt || Date.parse(bundle.release_at || "") || 0,
    createdAt,
    updatedAt: createdAt,
    tags: [],
    is_sealed: true,
    coreLocked: true,
    pairShared: true,
    ring_id: bundle.ring_id || null,
    haven_id: bundle.haven_id || null,
    createdByUserId: bundle.created_by_user_id || null,
    fromPartner: !ownedByYou,
  };
}

async function resolveCurrentUserId(accessToken) {
  if (accessToken) {
    const sb = getSupabaseBrowserClient();
    const { data } = await sb.auth.getUser(accessToken);
    if (data?.user?.id) return data.user.id;
  }
  const sb = getSupabaseBrowserClient();
  const { data } = await sb.auth.getSession();
  return data.session?.user?.id || "";
}

export function remintImportedPhotoRows(photo) {
  if (!Array.isArray(photo)) return photo;
  return photo.map((row) => {
    if (!row || typeof row !== "object") return row;
    return { ...row, id: crypto.randomUUID() };
  });
}

async function importPairBundle(bundle, currentUserId) {
  const payload = bundleToLocalPayload(bundle, currentUserId);
  if (!payload) return { imported: false, reason: "decode_failed" };

  const existing = await getMemoryById(payload.id);

  // Never let partner/ring sync overwrite a user-owned local memory.
  if (existing && !existing.fromPartner && payload.fromPartner) {
    return { imported: false, reason: "user_owned" };
  }

  if (payload.photo) {
    payload.photo = remintImportedPhotoRows(payload.photo);
  }

  const mergedPayload = existing
    ? { ...payload, supplements: mergeSupplements(existing.supplements, payload.supplements) }
    : payload;

  if (existing) {
    if (mergedPayload.fromPartner) {
      const localEmpty =
        !String(existing.story || "").trim() &&
        countDisplayablePhotos(existing.photo) === 0 &&
        !(Array.isArray(existing.attachments) && existing.attachments.length);
      const incomingPhotoCount = countDisplayablePhotos(mergedPayload.photo);
      const existingPhotoCount = countDisplayablePhotos(existing.photo);
      const photosUpgraded = incomingPhotoCount > existingPhotoCount;
      if (!existing.coreLocked || localEmpty || existing.fromPartner || photosUpgraded) {
        await saveMemory(mergedPayload, { allowCoreEdit: true });
        return { imported: true, reason: photosUpgraded ? "updated_partner_photos" : "updated_partner" };
      }
      return { imported: false, reason: "exists" };
    }
    if (existing.coreLocked) {
      return { imported: false, reason: "exists" };
    }
    await saveMemory(mergedPayload, { allowCoreEdit: true });
    return { imported: true, reason: "updated" };
  }

  await createMemory(mergedPayload);
  return { imported: true, reason: "created" };
}

/**
 * Pull Pair sealed bundles from server and merge into local timeline.
 */
export async function syncPairMemoriesFromServer(accessToken, options = {}) {
  if (!isPairSharingEnabled()) {
    return { ok: true, imported: 0, skipped: true, pairActive: false };
  }

  const token = accessToken || "";
  if (!token) {
    return { ok: false, imported: 0, reason: "auth" };
  }

  const since = options.fullPairSync ? "" : readImportCursor();
  const qs = since ? `?since=${encodeURIComponent(since)}` : "";
  let res;
  try {
    res = await fetch(`/api/sync/pair-bundles${qs}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { ok: false, imported: 0, reason: "network" };
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, imported: 0, reason: "api" };
  }

  const bundles = Array.isArray(json.bundles) ? json.bundles : [];
  const currentUserId = await resolveCurrentUserId(token);
  let imported = 0;
  let newestAt = since;

  for (const bundle of bundles) {
    if (!bundle?.encrypted_vault) continue;
    const result = await importPairBundle(bundle, currentUserId);
    if (result.imported) {
      imported += 1;
      const created = bundle.created_at || "";
      if (created && (!newestAt || Date.parse(created) > Date.parse(newestAt))) {
        newestAt = created;
      }
    }
  }

  if (newestAt && newestAt !== since) {
    writeImportCursor(newestAt);
  }

  return {
    ok: true,
    imported,
    pairActive: Boolean(json.pairActive),
    total: bundles.length,
    bundlesSeen: bundles.length,
  };
}

/** Backup a sealed memory for Plus cloud (cross-device supplements via manifest). */
export async function backupPairMemoryToCloud(memory) {
  if (!memory?.id || !isCloudBackupReady()) return { ok: false };
  try {
    await backupMemoryToCloud(memory);
    return { ok: true };
  } catch (error) {
    console.warn("[haven-ring] pair cloud backup skipped:", error);
    return { ok: false };
  }
}
