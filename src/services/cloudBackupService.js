import {
  CLOUD_STORAGE_FULL_CODE,
  CLOUD_STORAGE_FULL_MESSAGE,
  CLOUD_UPLOAD_CHUNK_BYTES,
} from "../../lib/cloud-storage-config";
import {
  decryptCloudBackupEnvelope,
  encryptCloudBackupPlaintext,
} from "../../lib/cloud-backup-crypto";
import {
  applyCloudMemoryToLocal,
  extractMemoryFromCloudPlaintext,
} from "../../lib/cloud-backup-merge";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { isIosWebKit } from "../../lib/composer-platform-limits";
import {
  deferIosPostBootWork,
  shouldAllowIosCloudRestore,
} from "../../lib/ios-app-boot";

/**
 * Haven Plus cloud backup — local-first, optional, 50 GB hard quota.
 * Uploads: client encrypt → gzip → chunked POST /api/cloud-backup/upload.
 */

const PREF_KEY = "haven.cloud-backup.settings.v1";
const FULL_EXPORT_MEMORY_ID = "00000000-0000-0000-0000-000000000000";
const IOS_RESTORE_BATCH_SIZE = 2;
const IOS_RESTORE_GAP_MS = 900;

let iosRestoreDeferred = false;

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

async function resolveCloudUserId() {
  const settings = readBackupSettings();
  if (settings.user?.id) return String(settings.user.id);
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id || "";
  if (!id) throw new Error("Sign in to use cloud backup.");
  return id;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

async function buildEncryptedBackupBlob(payload, opts = {}) {
  const userId = await resolveCloudUserId();
  const backedUpAt = Date.now();
  const kind = String(opts.kind || payload?.kind || "pair_memory");
  const memoryId =
    opts.memoryId != null
      ? String(opts.memoryId)
      : String(payload?.memoryId || payload?.id || FULL_EXPORT_MEMORY_ID);
  const slimmed = slimPayloadForCloud(payload?.payload ?? payload);
  const envelope = await encryptCloudBackupPlaintext(
    {
      backedUpAt,
      kind,
      memoryId: memoryId === FULL_EXPORT_MEMORY_ID ? null : memoryId,
      payload: slimmed,
    },
    userId
  );
  const json = JSON.stringify({ version: 2, encrypted: envelope, compressed: true });
  const raw = new Blob([json], { type: "application/json" });
  if (typeof CompressionStream !== "undefined") {
    const compressed = await new Response(
      raw.stream().pipeThrough(new CompressionStream("gzip"))
    ).blob();
    return { blob: compressed, originalBytes: raw.size, compressed: true };
  }
  return { blob: raw, originalBytes: raw.size, compressed: false };
}

export async function compressPayloadForCloud(payload, opts = {}) {
  return buildEncryptedBackupBlob(payload, opts);
}

async function decompressBackupBytes(bytes, compressed) {
  if (!compressed) {
    return typeof bytes === "string" ? bytes : new TextDecoder().decode(bytes);
  }
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot decompress cloud backups.");
  }
  const blob = new Blob([bytes]);
  const decompressed = await new Response(
    blob.stream().pipeThrough(new DecompressionStream("gzip"))
  ).arrayBuffer();
  return new TextDecoder().decode(decompressed);
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

async function uploadCompressedBlobChunked(accessToken, blob, compressed, manifest = {}) {
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
      memory_id: manifest.memoryId || null,
      kind: manifest.kind || "pair_memory",
      version: manifest.version || 1,
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
  return { ...commitJson, upload_id: uploadId };
}

/**
 * Backup local payload to cloud (encrypt + compress + chunk + quota + manifest).
 */
export async function backupToCloud(payload, opts = {}) {
  ensureReady();
  const accessToken = await resolveAccessToken();
  const kind = String(opts.kind || payload?.kind || "full_export");
  const memoryId =
    opts.memoryId != null
      ? String(opts.memoryId)
      : String(payload?.memoryId || payload?.id || FULL_EXPORT_MEMORY_ID);
  const { blob, compressed } = await buildEncryptedBackupBlob(payload, {
    kind,
    memoryId,
  });
  await precheckCloudUpload(accessToken, blob.size);
  const result = await uploadCompressedBlobChunked(accessToken, blob, compressed, {
    memoryId,
    kind,
    version: 1,
  });
  return { ok: true, quota: result, upload_id: result.upload_id };
}

/** Backup one sealed memory (includes supplements) with per-memory manifest. */
export async function backupMemoryToCloud(memory) {
  if (!memory?.id) return { ok: false, reason: "missing_memory" };
  return backupToCloud(
    {
      kind: "pair_memory",
      memoryId: memory.id,
      payload: memory,
    },
    { kind: "pair_memory", memoryId: memory.id }
  );
}

async function fetchLatestBackups(accessToken, memoryId = "") {
  const qs = memoryId ? `?memory_id=${encodeURIComponent(memoryId)}` : "";
  const res = await fetch(`/api/cloud-backup/latest${qs}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json?.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Could not list cloud backups."
    );
  }
  return Array.isArray(json.backups) ? json.backups : [];
}

async function downloadBackupBlob(accessToken, uploadId) {
  const res = await fetch(
    `/api/cloud-backup/latest?upload_id=${encodeURIComponent(uploadId)}&include_data=1`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data_b64) {
    throw new Error(
      typeof json?.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Cloud backup download failed."
    );
  }
  return base64ToBytes(json.data_b64);
}

async function decodeCloudBackupBlob(bytes) {
  let text = "";
  try {
    text = await decompressBackupBytes(bytes, true);
  } catch {
    text = await decompressBackupBytes(bytes, false);
  }
  const wrapper = JSON.parse(text);
  if (wrapper?.encrypted?.v === 1) {
    const userId = await resolveCloudUserId();
    return decryptCloudBackupEnvelope(wrapper.encrypted, userId);
  }
  if (wrapper?.version === 1 && wrapper?.payload) {
    return wrapper.payload;
  }
  throw new Error("Unsupported cloud backup format.");
}

async function mergeBackupRowIntoLocal(uploadId, accessToken) {
  const bytes = await downloadBackupBlob(accessToken, uploadId);
  const plaintext = await decodeCloudBackupBlob(bytes);
  if (plaintext?.kind === "full_export") {
    const rows = Array.isArray(plaintext.payload) ? plaintext.payload : [];
    let merged = 0;
    for (const row of rows) {
      const result = await applyCloudMemoryToLocal(extractMemoryFromCloudPlaintext({ payload: row }));
      if (result.merged) merged += 1;
    }
    return { merged, kind: "full_export" };
  }
  const memory = extractMemoryFromCloudPlaintext(plaintext);
  const result = await applyCloudMemoryToLocal(memory);
  return { merged: result.merged ? 1 : 0, kind: plaintext?.kind || "pair_memory" };
}

/**
 * Restore cloud backups and merge supplements into local memories (local core wins).
 */
export async function restoreFromCloud(memoryId = "") {
  ensureReady();
  const accessToken = await resolveAccessToken();
  const backups = await fetchLatestBackups(accessToken, memoryId);
  if (!backups.length) {
    return {
      ok: true,
      merged: 0,
      message: "No cloud backup found yet.",
    };
  }

  let merged = 0;
  const rows = isIosWebKit() ? backups.slice(0, IOS_RESTORE_BATCH_SIZE) : backups;
  for (const row of rows) {
    if (!row?.upload_id) continue;
    if (row.kind === "full_export") {
      const outcome = await mergeBackupRowIntoLocal(row.upload_id, accessToken);
      merged += outcome.merged;
      if (isIosWebKit()) await delay(IOS_RESTORE_GAP_MS);
      continue;
    }
    if (memoryId && row.memory_id && row.memory_id !== memoryId) continue;
    const outcome = await mergeBackupRowIntoLocal(row.upload_id, accessToken);
    merged += outcome.merged;
    if (isIosWebKit()) await delay(IOS_RESTORE_GAP_MS);
  }

  return {
    ok: true,
    merged,
    message:
      merged > 0
        ? `Merged notes from ${merged} cloud backup${merged === 1 ? "" : "s"}.`
        : "Cloud backup checked — your local notes are already up to date.",
  };
}

/** Background restore — never throws; used after login / pull-refresh / sync. */
export async function restoreCloudBackupsQuietly(memoryId = "") {
  if (!isCloudBackupReady()) return { ok: true, merged: 0, skipped: true };
  if (isIosWebKit() && !shouldAllowIosCloudRestore()) {
    if (!iosRestoreDeferred) {
      iosRestoreDeferred = true;
      deferIosPostBootWork(
        () => {
          iosRestoreDeferred = false;
          void restoreCloudBackupsQuietly(memoryId);
        },
        16_000,
        { timeout: 18_000 }
      );
    }
    return { ok: true, merged: 0, deferred: true };
  }
  try {
    return await restoreFromCloud(memoryId);
  } catch (error) {
    console.warn("[haven-ring] cloud restore skipped:", error);
    return { ok: false, merged: 0 };
  }
}
