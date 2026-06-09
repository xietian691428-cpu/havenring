import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  SEAL_STAGING_BUCKET,
  SEAL_STAGING_DB_INLINE_MAX_BYTES,
  SEAL_STAGING_MAX_BYTES,
  SEAL_STAGING_SIGNED_URL_TTL_SEC,
} from "@/lib/seal-staging-config";
import {
  hashSealStagingContent,
  parseSealStagingDraftIds,
  sealStagingExpiryIso,
} from "@/lib/seal-staging-shared";
import { recordSealStagingTelemetry } from "@/lib/seal-staging-telemetry";

export type SealStagingRow = {
  id: string;
  user_id: string;
  draft_ids: unknown;
  ciphertext: string | null;
  iv: string;
  storage_path: string | null;
  storage_backend: "db" | "object";
  byte_size: number;
  expires_at: string;
  consumed_at: string | null;
};

function stagingObjectPath(userId: string, stagingId: string): string {
  return `${userId}/${stagingId}.bin`;
}

function binarySizeFromBase64(ciphertextB64: string): number {
  const trimmed = ciphertextB64.trim();
  if (!trimmed) return 0;
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

async function deleteStagingObject(admin: ReturnType<typeof getSupabaseAdminClient>, path: string) {
  if (!path) return;
  try {
    await admin.storage.from(SEAL_STAGING_BUCKET).remove([path]);
  } catch {
    /* best effort */
  }
}

export async function loadSealStagingRow(
  stagingId: string,
  userId: string
): Promise<SealStagingRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("seal_staging" as never)
    .select(
      "id, user_id, draft_ids, ciphertext, iv, storage_path, storage_backend, byte_size, expires_at, consumed_at"
    )
    .eq("id", stagingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SealStagingRow;
}

export async function createSealStagingRecord(opts: {
  userId: string;
  draftIds: string[];
  ciphertextB64: string;
  iv: string;
}): Promise<{ id: string; expires_at: string; storage_backend: "db" | "object"; byte_size: number }> {
  const startedAt = Date.now();
  const admin = getSupabaseAdminClient();
  const draftIds = parseSealStagingDraftIds(opts.draftIds);
  const iv = String(opts.iv || "").trim();
  const ciphertextB64 = String(opts.ciphertextB64 || "").trim();
  const byteSize = binarySizeFromBase64(ciphertextB64);

  if (!draftIds.length || !iv || !ciphertextB64) {
    throw new Error("MISSING_STAGING_DATA");
  }
  if (byteSize > SEAL_STAGING_MAX_BYTES) {
    throw new Error("STAGING_TOO_LARGE");
  }

  const expiresAt = sealStagingExpiryIso();
  const id = crypto.randomUUID();
  const useObject = byteSize > SEAL_STAGING_DB_INLINE_MAX_BYTES;
  const storageBackend: "db" | "object" = useObject ? "object" : "db";
  let storagePath: string | null = null;
  let dbCiphertext: string | null = ciphertextB64;

  if (useObject) {
    storagePath = stagingObjectPath(opts.userId, id);
    const body = Buffer.from(ciphertextB64, "base64");
    const { error: uploadErr } = await admin.storage
      .from(SEAL_STAGING_BUCKET)
      .upload(storagePath, body, {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) {
      await recordSealStagingTelemetry(admin, {
        user_id: opts.userId,
        phase: "create",
        outcome: "error",
        error_code: "STORAGE_UPLOAD_FAILED",
        storage_backend: "object",
        byte_size: byteSize,
        latency_ms: Date.now() - startedAt,
      });
      throw new Error("STORAGE_UPLOAD_FAILED");
    }
    dbCiphertext = null;
  }

  const { data, error } = await admin
    .from("seal_staging" as never)
    .insert({
      id,
      user_id: opts.userId,
      draft_ids: draftIds,
      ciphertext: dbCiphertext,
      iv,
      storage_path: storagePath,
      storage_backend: storageBackend,
      byte_size: byteSize,
      content_sha256: hashSealStagingContent(ciphertextB64),
      expires_at: expiresAt,
    } as never)
    .select("id, expires_at, storage_backend, byte_size")
    .single();

  if (error || !data) {
    if (storagePath) await deleteStagingObject(admin, storagePath);
    await recordSealStagingTelemetry(admin, {
      user_id: opts.userId,
      phase: "create",
      outcome: "error",
      error_code: "STAGING_CREATE_FAILED",
      storage_backend: storageBackend,
      byte_size: byteSize,
      latency_ms: Date.now() - startedAt,
    });
    throw new Error("STAGING_CREATE_FAILED");
  }

  const row = data as {
    id: string;
    expires_at: string;
    storage_backend: "db" | "object";
    byte_size: number;
  };

  await recordSealStagingTelemetry(admin, {
    user_id: opts.userId,
    phase: "create",
    outcome: "success",
    storage_backend: row.storage_backend,
    byte_size: row.byte_size,
    latency_ms: Date.now() - startedAt,
  });

  return row;
}

export async function resolveSealStagingCiphertext(
  row: SealStagingRow
): Promise<{ delivery: "inline" | "signed_url"; ciphertext?: string; signed_url?: string }> {
  if (row.storage_backend === "db" && row.ciphertext) {
    return { delivery: "inline", ciphertext: row.ciphertext };
  }
  if (row.storage_path) {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.storage
      .from(SEAL_STAGING_BUCKET)
      .createSignedUrl(row.storage_path, SEAL_STAGING_SIGNED_URL_TTL_SEC);
    if (error || !data?.signedUrl) {
      throw new Error("STAGING_SIGNED_URL_FAILED");
    }
    return { delivery: "signed_url", signed_url: data.signedUrl };
  }
  throw new Error("STAGING_PAYLOAD_MISSING");
}

/** Hard-delete staging row + storage object after seal commit or explicit cancel. */
export async function consumeSealStagingById(
  stagingId: string,
  userId: string
): Promise<void> {
  const id = String(stagingId || "").trim();
  if (!id || !userId) return;
  const admin = getSupabaseAdminClient();
  const row = await loadSealStagingRow(id, userId);
  if (row?.storage_path) {
    await deleteStagingObject(admin, row.storage_path);
  }
  await admin.from("seal_staging" as never).delete().eq("id", id).eq("user_id", userId);
}

/** Purge expired rows and orphan storage objects (cron). */
export async function purgeExpiredSealStaging(): Promise<{
  deleted_rows: number;
  deleted_objects: number;
}> {
  const admin = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from("seal_staging" as never)
    .select("id, user_id, storage_path")
    .lt("expires_at", now);

  const rows = (expired as Array<{ id: string; storage_path: string | null }> | null) ?? [];
  let deletedObjects = 0;
  for (const row of rows) {
    if (row.storage_path) {
      await deleteStagingObject(admin, row.storage_path);
      deletedObjects += 1;
    }
  }

  const { error } = await admin.from("seal_staging" as never).delete().lt("expires_at", now);
  if (error) {
    await recordSealStagingTelemetry(admin, {
      phase: "purge",
      outcome: "error",
      error_code: "PURGE_FAILED",
    });
    throw error;
  }

  await recordSealStagingTelemetry(admin, {
    phase: "purge",
    outcome: "success",
    byte_size: rows.length,
    latency_ms: deletedObjects,
  });

  return { deleted_rows: rows.length, deleted_objects: deletedObjects };
}
