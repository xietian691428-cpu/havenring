import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  CLOUD_STORAGE_FULL_CODE,
  CLOUD_STORAGE_FULL_MESSAGE,
} from "@/lib/cloud-storage-config";
import {
  assertCloudQuotaForUpload,
  commitCloudUpload,
  getCloudQuotaForUser,
  requirePlusCloudBackup,
  storeCloudUploadChunk,
} from "@/lib/cloud-storage-server";
import {
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

type UploadBody = {
  mode?: unknown;
  upload_id?: unknown;
  chunk_index?: unknown;
  total_chunks?: unknown;
  data_b64?: unknown;
  byte_size?: unknown;
  compressed?: unknown;
  memory_id?: unknown;
  kind?: unknown;
  version?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    await requirePlusCloudBackup(user.id);

    const limitRes = await enforceUserRateLimit({
      userId: user.id,
      scope: "cloud-backup-upload",
      policy: API_RATE_POLICIES.cloudBackupUpload,
    });
    if (limitRes) return limitRes;

    const body = (await req.json()) as UploadBody;
    const mode = typeof body.mode === "string" ? body.mode : "chunk";

    if (mode === "precheck") {
      const byteSize = Math.max(0, Number(body.byte_size || 0) || 0);
      try {
        const snapshot = await assertCloudQuotaForUpload(user.id, byteSize);
        return NextResponse.json({ ok: true, ...snapshot });
      } catch (error) {
        if (error instanceof Error && error.message === CLOUD_STORAGE_FULL_CODE) {
          const snapshot = await getCloudQuotaForUser(user.id);
          return NextResponse.json(
            {
              ok: false,
              error: CLOUD_STORAGE_FULL_MESSAGE,
              error_code: CLOUD_STORAGE_FULL_CODE,
              ...snapshot,
            },
            { status: 413 }
          );
        }
        throw error;
      }
    }

    if (mode === "commit") {
      const uploadId = String(body.upload_id || "").trim();
      const totalChunks = Math.max(0, Number(body.total_chunks || 0) || 0);
      const byteSize = Math.max(0, Number(body.byte_size || 0) || 0);
      if (!uploadId || !totalChunks || !byteSize) {
        return NextResponse.json(
          { error: "Missing commit fields.", error_code: "MISSING_COMMIT_DATA" },
          { status: 400 }
        );
      }
      try {
        const snapshot = await commitCloudUpload({
          userId: user.id,
          uploadId,
          totalChunks,
          storedByteSize: byteSize,
          memoryId: typeof body.memory_id === "string" ? body.memory_id : null,
          kind: typeof body.kind === "string" ? body.kind : null,
          version: Number(body.version || 1) || 1,
        });
        return NextResponse.json({ ok: true, ...snapshot });
      } catch (error) {
        if (error instanceof Error && error.message === CLOUD_STORAGE_FULL_CODE) {
          const snapshot = await getCloudQuotaForUser(user.id);
          return NextResponse.json(
            {
              ok: false,
              error: CLOUD_STORAGE_FULL_MESSAGE,
              error_code: CLOUD_STORAGE_FULL_CODE,
              ...snapshot,
            },
            { status: 413 }
          );
        }
        throw error;
      }
    }

    const uploadId = String(body.upload_id || "").trim();
    const chunkIndex = Number(body.chunk_index);
    const totalChunks = Math.max(1, Number(body.total_chunks || 0) || 0);
    const dataB64 = typeof body.data_b64 === "string" ? body.data_b64.trim() : "";
    if (!uploadId || !Number.isFinite(chunkIndex) || chunkIndex < 0 || !dataB64) {
      return NextResponse.json(
        { error: "Missing chunk fields.", error_code: "MISSING_CHUNK_DATA" },
        { status: 400 }
      );
    }

    const stored = await storeCloudUploadChunk({
      userId: user.id,
      uploadId,
      chunkIndex,
      dataB64,
    });

    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
      stored_bytes: stored,
      compressed: body.compressed === true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLOUD_BACKUP_PLUS_REQUIRED") {
      return NextResponse.json(
        { error: "Haven Plus required for cloud backup.", error_code: "PLUS_REQUIRED" },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "Upload failed.", error_code: "CLOUD_UPLOAD_FAILED" },
      { status: 500 }
    );
  }
}
