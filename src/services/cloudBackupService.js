import {
  CLOUD_STORAGE_FULL_CODE,
  CLOUD_STORAGE_FULL_MESSAGE,
  CLOUD_UPLOAD_CHUNK_BYTES,
} from "../../lib/cloud-storage-config";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

/**
 * Haven Plus cloud backup — local-first, optional, 50 GB hard quota.
 * Uploads: gzip compress → chunked POST /api/cloud-backup/upload.
 */

const PREF_KEY = "haven.cloud-backup.settings.v1";

export { CLOUD_STORAGE_FULL_CODE, CLOUD_STORAGE_FULL_MESSAGE };

function readBackupSettings() {
  if (typeof window === "undefined") {
    return { enabled: false, provider: "apple", user: null };
  }
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return { enabled: false, provider: "apple", user: null };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      provider: parsed?.provider || "apple",
      user: parsed?.user || null,
    };
  } catch {
    return { enabled: false, provider: "apple", user: null };
  }
}

function writeBackupSettings(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
}

export function getCloudBackupSettings() {
  return readBackupSettings();
}

export function setCloudBackupEnabled(enabled) {
  const prev = readBackupSettings();
  const next = {
    ...prev,
    enabled: Boolean(enabled),
  };
  writeBackupSettings(next);
  return next;
}

/** Link cloud-backup prefs to the active Haven app session (same Apple/Google account). */
export async function syncCloudBackupFromAuthSession() {
  const prev = readBackupSettings();
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (!sessionUser?.id) {
    return prev;
  }
  const provider =
    (typeof sessionUser.app_metadata?.provider === "string" &&
      sessionUser.app_metadata.provider) ||
    prev.provider ||
    "apple";
  const next = {
    ...prev,
    provider,
    user: {
      id: sessionUser.id,
      provider,
      email: sessionUser.email || null,
      linkedAt: Date.now(),
    },
  };
  writeBackupSettings(next);
  return next;
}

export async function signInWithApple() {
  return syncCloudBackupFromAuthSession();
}

export async function signOutCloudBackup() {
  const prev = readBackupSettings();
  const next = {
    ...prev,
    user: null,
  };
  writeBackupSettings(next);
  return next;
}

export function isCloudBackupReady() {
  const settings = readBackupSettings();
  return settings.enabled === true && Boolean(settings.user?.id);
}

function ensureReady() {
  const settings = readBackupSettings();
  if (!settings.enabled) {
    throw new Error("Cloud backup is disabled. Enable it first.");
  }
  if (!settings.user) {
    throw new Error("Cloud backup requires sign-in before backup or restore.");
  }
  return settings;
}

async function resolveAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";
  if (!token) {
    throw new Error("Sign in to use cloud backup.");
  }
  return token;
}

function authHeaders(accessToken) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Split a Blob for resumable Plus uploads. */
export function chunkBlobForCloudUpload(blob, chunkBytes = CLOUD_UPLOAD_CHUNK_BYTES) {
  const size = Math.max(1, Number(chunkBytes) || CLOUD_UPLOAD_CHUNK_BYTES);
  const chunks = [];
  for (let offset = 0; offset < blob.size; offset += size) {
    chunks.push(blob.slice(offset, offset + size));
  }
  return chunks;
}

function slimMediaRow(row) {
  if (!row || typeof row !== "object") return row;
  const dataUrl = typeof row.dataUrl === "string" ? row.dataUrl : "";
  if (!dataUrl || dataUrl.length < 400_000) return row;
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    dataUrl,
  };
}

/** Drop inline blobs only when extremely large; gzip handles the rest. */
export function slimPayloadForCloud(payload) {
  if (!payload) return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => slimPayloadForCloud(item));
  }
  if (typeof payload !== "object") return payload;
  const next = { ...payload };
  if (Array.isArray(next.photo)) {
    next.photo = next.photo.map(slimMediaRow);
  }
  if (Array.isArray(next.attachments)) {
    next.attachments = next.attachments.map(slimMediaRow);
  }
  return next;
}

export async function compressPayloadForCloud(payload) {
  const slimmed = slimPayloadForCloud(payload);
  const json = JSON.stringify({
    version: 1,
    backedUpAt: Date.now(),
    payload: slimmed,
  });
  const raw = new Blob([json], { type: "application/json" });
  if (typeof CompressionStream !== "undefined") {
    const compressed = await new Response(
      raw.stream().pipeThrough(new CompressionStream("gzip"))
    ).blob();
    return { blob: compressed, originalBytes: raw.size, compressed: true };
  }
  return { blob: raw, originalBytes: raw.size, compressed: false };
}

export async function fetchCloudStorageQuota(accessToken, additionalBytes = 0) {
  const probe =
    additionalBytes > 0 ? `?additional_bytes=${encodeURIComponent(String(additionalBytes))}` : "";
  const res = await fetch(`/api/cloud-backup/quota${probe}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json?.error_code === CLOUD_STORAGE_FULL_CODE) {
      throw new Error(CLOUD_STORAGE_FULL_MESSAGE);
    }
    throw new Error(
      typeof json?.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Could not read cloud storage quota."
    );
  }
  return json;
}

async function precheckCloudUpload(accessToken, byteSize) {
  const res = await fetch("/api/cloud-backup/upload", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      mode: "precheck",
      byte_size: byteSize,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    if (json?.error_code === CLOUD_STORAGE_FULL_CODE) {
      throw new Error(CLOUD_STORAGE_FULL_MESSAGE);
    }
    throw new Error(
      typeof json?.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Cloud backup could not start."
    );
  }
  return json;
}

async function uploadCompressedBlobChunked(accessToken, blob, compressed) {
  const uploadId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `upload-${Date.now()}`;
  const chunks = chunkBlobForCloudUpload(blob);
  for (let i = 0; i < chunks.length; i += 1) {
    const buf = new Uint8Array(await chunks[i].arrayBuffer());
    const res = await fetch("/api/cloud-backup/upload", {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        mode: "chunk",
        upload_id: uploadId,
        chunk_index: i,
        total_chunks: chunks.length,
        data_b64: bytesToBase64(buf),
        compressed,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok !== true) {
      throw new Error(
        typeof json?.error === "string" && json.error.trim()
          ? json.error.trim()
          : "Cloud upload failed."
      );
    }
  }
  const commitRes = await fetch("/api/cloud-backup/upload", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      mode: "commit",
      upload_id: uploadId,
      total_chunks: chunks.length,
      byte_size: blob.size,
      compressed,
    }),
  });
  const commitJson = await commitRes.json().catch(() => ({}));
  if (!commitRes.ok || commitJson?.ok !== true) {
    if (commitJson?.error_code === CLOUD_STORAGE_FULL_CODE) {
      throw new Error(CLOUD_STORAGE_FULL_MESSAGE);
    }
    throw new Error(
      typeof commitJson?.error === "string" && commitJson.error.trim()
        ? commitJson.error.trim()
        : "Cloud backup could not finish."
    );
  }
  return commitJson;
}

/**
 * Backup local payload to cloud (compress + chunk + quota).
 */
export async function backupToCloud(payload) {
  ensureReady();
  const accessToken = await resolveAccessToken();
  const { blob, compressed } = await compressPayloadForCloud(payload);
  await precheckCloudUpload(accessToken, blob.size);
  const result = await uploadCompressedBlobChunked(accessToken, blob, compressed);
  return { ok: true, quota: result };
}

/**
 * Restore framework — latest snapshot not yet wired.
 */
export async function restoreFromCloud() {
  const settings = ensureReady();
  return {
    ok: true,
    provider: settings.provider,
    payload: null,
    message: "No cloud snapshot yet.",
  };
}
