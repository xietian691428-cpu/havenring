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
}): Promise<CloudQuotaSnapshot> {
  const admin = getSupabaseAdminClient();
  const byteSize = Math.max(0, opts.storedByteSize);
  const used = await readCloudUsageBytes(opts.userId);
  assertCloudQuotaHeadroom(used, byteSize);

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

  const nextUsed = used + byteSize;
  const quotaUserId = await resolveCloudQuotaUserId(admin, opts.userId);
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
