import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  CLOUD_BACKUP_BUCKET,
  CLOUD_STORAGE_FULL_CODE,
  CLOUD_STORAGE_QUOTA_BYTES,
} from "./cloud-storage-config";
import { getUserSubscriptionStatus } from "./subscription";
import { resolveCloudQuotaUserId } from "./haven-plus";

export type CloudQuotaSnapshot = {
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
};

export type CloudMemoryBackupRow = {
  id: string;
  user_id: string;
  memory_id: string;
  upload_id: string;
  backed_up_at: string;
  version: number;
  byte_size: number;
  kind: string;
};

const FULL_EXPORT_MEMORY_ID = "00000000-0000-0000-0000-000000000000";

function pendingChunkPath(userId: string, uploadId: string, chunkIndex: number): string {
  return `${userId}/pending/${uploadId}/${chunkIndex}.bin`;
}

function backupObjectPath(userId: string, uploadId: string): string {
  return `${userId}/backups/${uploadId}.bin`;
}

export async function requirePlusCloudBackup(userId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const status = await getUserSubscriptionStatus(admin, userId);
  if (status.tier !== "plus") {
    throw new Error("CLOUD_BACKUP_PLUS_REQUIRED");
  }
}

export async function readCloudUsageBytes(userId: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const quotaUserId = await resolveCloudQuotaUserId(admin, userId);
  const { data, error } = await admin
    .from("cloud_backup_usage" as never)
    .select("bytes_used")
    .eq("user_id", quotaUserId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { bytes_used?: number } | null;
  return Number(row?.bytes_used || 0) || 0;
}

export function buildQuotaSnapshot(usedBytes: number): CloudQuotaSnapshot {
  const used = Math.max(0, usedBytes);
  const limit = CLOUD_STORAGE_QUOTA_BYTES;
  return {
    usedBytes: used,
    limitBytes: limit,
    remainingBytes: Math.max(0, limit - used),
  };
}

export async function getCloudQuotaForUser(userId: string): Promise<CloudQuotaSnapshot> {
  const used = await readCloudUsageBytes(userId);
  return buildQuotaSnapshot(used);
}

export function assertCloudQuotaHeadroom(
  usedBytes: number,
  additionalBytes: number
): CloudQuotaSnapshot {
  const add = Math.max(0, additionalBytes);
  const snapshot = buildQuotaSnapshot(usedBytes);
  if (add > snapshot.remainingBytes) {
    const err = new Error(CLOUD_STORAGE_FULL_CODE);
    (err as Error & { code: string }).code = CLOUD_STORAGE_FULL_CODE;
    throw err;
  }
  return snapshot;
}

export async function assertCloudQuotaForUpload(
  userId: string,
  additionalBytes: number
): Promise<CloudQuotaSnapshot> {
  const used = await readCloudUsageBytes(userId);
  return assertCloudQuotaHeadroom(used, additionalBytes);
}

export async function storeCloudUploadChunk(opts: {
  userId: string;
  uploadId: string;
  chunkIndex: number;
  dataB64: string;
}): Promise<number> {
  const admin = getSupabaseAdminClient();
  const path = pendingChunkPath(opts.userId, opts.uploadId, opts.chunkIndex);
  const body = Buffer.from(opts.dataB64, "base64");
  const { error } = await admin.storage.from(CLOUD_BACKUP_BUCKET).upload(path, body, {
    contentType: "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error("CLOUD_CHUNK_UPLOAD_FAILED");
  return body.length;
}

async function listPendingChunkPaths(userId: string, uploadId: string): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  const prefix = `${userId}/pending/${uploadId}`;
  const { data, error } = await admin.storage.from(CLOUD_BACKUP_BUCKET).list(prefix);
  if (error) throw error;
  return (data || [])
    .map((row) => row.name)
    .filter(Boolean)
    .sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]))
    .map((name) => `${prefix}/${name}`);
}

async function removePaths(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const admin = getSupabaseAdminClient();
  try {
    await admin.storage.from(CLOUD_BACKUP_BUCKET).remove(paths);
  } catch {
    /* best effort */
  }
}

export async function commitCloudUpload(opts: {
  userId: string;
  uploadId: string;
  totalChunks: number;
  storedByteSize: number;
  memoryId?: string | null;
  kind?: string | null;
  version?: number | null;
}): Promise<CloudQuotaSnapshot> {
  const admin = getSupabaseAdminClient();
  const byteSize = Math.max(0, opts.storedByteSize);
  const memoryId = String(opts.memoryId || "").trim() || FULL_EXPORT_MEMORY_ID;
  const kind = String(opts.kind || "pair_memory").trim() || "pair_memory";
  const version = Math.max(1, Number(opts.version || 1) || 1);

  const quotaUserId = await resolveCloudQuotaUserId(admin, opts.userId);
  const used = await readCloudUsageBytes(opts.userId);

  const { data: priorRows, error: priorErr } = await admin
    .from("cloud_memory_backups" as never)
    .select("upload_id, byte_size")
    .eq("user_id", quotaUserId)
    .eq("memory_id", memoryId)
    .order("backed_up_at", { ascending: false });
  if (priorErr) throw priorErr;
  const prior = (priorRows || []) as Array<{ upload_id?: string; byte_size?: number }>;
  const reclaimedBytes = prior.reduce((sum, row) => sum + Number(row.byte_size || 0), 0);
  const netDelta = Math.max(0, byteSize - reclaimedBytes);
  assertCloudQuotaHeadroom(used, netDelta);

  const pending = await listPendingChunkPaths(opts.userId, opts.uploadId);
  if (pending.length !== opts.totalChunks) {
    throw new Error("CLOUD_CHUNK_SET_INCOMPLETE");
  }

  const dest = backupObjectPath(opts.userId, opts.uploadId);
  if (pending.length === 1) {
    const { data: blob, error: dlErr } = await admin.storage
      .from(CLOUD_BACKUP_BUCKET)
      .download(pending[0]!);
    if (dlErr || !blob) throw new Error("CLOUD_COMMIT_FAILED");
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await admin.storage.from(CLOUD_BACKUP_BUCKET).upload(dest, buf, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (upErr) throw new Error("CLOUD_COMMIT_FAILED");
  } else {
    const parts: Buffer[] = [];
    for (const path of pending) {
      const { data: blob, error } = await admin.storage.from(CLOUD_BACKUP_BUCKET).download(path);
      if (error || !blob) throw new Error("CLOUD_COMMIT_FAILED");
      parts.push(Buffer.from(await blob.arrayBuffer()));
    }
    const merged = Buffer.concat(parts);
    const { error: upErr } = await admin.storage.from(CLOUD_BACKUP_BUCKET).upload(dest, merged, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (upErr) throw new Error("CLOUD_COMMIT_FAILED");
  }

  await removePaths(pending);

  if (prior.length) {
    const oldPaths = prior
      .map((row) => row.upload_id)
      .filter(Boolean)
      .map((uploadId) => backupObjectPath(opts.userId, String(uploadId)));
    await removePaths(oldPaths);
    await admin
      .from("cloud_memory_backups" as never)
      .delete()
      .eq("user_id", quotaUserId)
      .eq("memory_id", memoryId);
  }

  const { error: insertErr } = await admin.from("cloud_memory_backups" as never).insert({
    user_id: quotaUserId,
    memory_id: memoryId,
    upload_id: opts.uploadId,
    backed_up_at: new Date().toISOString(),
    version,
    byte_size: byteSize,
    kind,
  } as never);
  if (insertErr) throw insertErr;

  const nextUsed = Math.max(0, used - reclaimedBytes + byteSize);
  const { error: upsertErr } = await admin.from("cloud_backup_usage" as never).upsert(
    {
      user_id: quotaUserId,
      bytes_used: nextUsed,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" }
  );
  if (upsertErr) throw upsertErr;

  return buildQuotaSnapshot(nextUsed);
}

export async function listLatestCloudMemoryBackups(
  userId: string,
  memoryId?: string | null
): Promise<CloudMemoryBackupRow[]> {
  const admin = getSupabaseAdminClient();
  const quotaUserId = await resolveCloudQuotaUserId(admin, userId);
  let query = admin
    .from("cloud_memory_backups" as never)
    .select("id, user_id, memory_id, upload_id, backed_up_at, version, byte_size, kind")
    .eq("user_id", quotaUserId)
    .order("backed_up_at", { ascending: false })
    .limit(200);
  const filterMemoryId = String(memoryId || "").trim();
  if (filterMemoryId) {
    query = query.eq("memory_id", filterMemoryId);
  }
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as CloudMemoryBackupRow[];
  if (filterMemoryId) return rows.slice(0, 1);

  const latestByMemory = new Map<string, CloudMemoryBackupRow>();
  for (const row of rows) {
    if (!latestByMemory.has(row.memory_id)) {
      latestByMemory.set(row.memory_id, row);
    }
  }
  return [...latestByMemory.values()];
}

export async function downloadCloudBackupObject(
  userId: string,
  uploadId: string
): Promise<Buffer> {
  const admin = getSupabaseAdminClient();
  const path = backupObjectPath(userId, uploadId);
  const { data, error } = await admin.storage.from(CLOUD_BACKUP_BUCKET).download(path);
  if (error || !data) throw new Error("CLOUD_BACKUP_NOT_FOUND");
  return Buffer.from(await data.arrayBuffer());
}
