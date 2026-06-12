import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  isSealStagingApiEnabled,
  resolveSealStagingMaxBytes,
} from "@/lib/seal-staging-config";
import { getUserSubscriptionStatus } from "@/lib/subscription";
import {
  assembleSealStagingCiphertextFromChunks,
  createSealStagingRecord,
  storeSealStagingChunk,
} from "@/lib/seal-staging-server";
import { recordSealStagingTelemetry } from "@/lib/seal-staging-telemetry";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import { parseSealStagingDraftIds } from "@/lib/seal-staging-shared";

type StagingBody = {
  mode?: unknown;
  draft_ids?: unknown;
  ciphertext?: unknown;
  iv?: unknown;
  upload_id?: unknown;
  chunk_index?: unknown;
  total_chunks?: unknown;
  data_b64?: unknown;
  byte_size?: unknown;
};

function stagingErrorResponse(
  error: unknown,
  userId: string,
  startedAt: number
): NextResponse {
  const code = error instanceof Error ? error.message : "STAGING_CREATE_FAILED";
  if (code === "STAGING_TOO_LARGE") {
    return NextResponse.json(
      { error: "Staging payload too large.", error_code: "STAGING_TOO_LARGE" },
      { status: 413 }
    );
  }
  void recordSealStagingTelemetry(getSupabaseAdminClient(), {
    user_id: userId,
    phase: "create",
    outcome: "error",
    error_code: code,
    latency_ms: Date.now() - startedAt,
  }).catch(() => null);
  return NextResponse.json(
    { error: "Could not create staging.", error_code: code },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);

    if (!isSealStagingApiEnabled()) {
      return NextResponse.json(
        { error: "Seal staging is temporarily unavailable.", error_code: "STAGING_DISABLED" },
        { status: 503 }
      );
    }

    const limitRes = await enforceUserRateLimit({
      userId: user.id,
      scope: "seal-staging-create",
      policy: API_RATE_POLICIES.sealStagingCreate,
    });
    if (limitRes) return limitRes;

    const body = (await req.json()) as StagingBody;
    const mode = typeof body.mode === "string" ? body.mode : "create";

    if (mode === "chunk") {
      const uploadId = String(body.upload_id || "").trim();
      const chunkIndex = Number(body.chunk_index);
      const dataB64 = typeof body.data_b64 === "string" ? body.data_b64.trim() : "";
      if (!uploadId || !Number.isFinite(chunkIndex) || chunkIndex < 0 || !dataB64) {
        return NextResponse.json(
          { error: "Missing chunk fields.", error_code: "MISSING_CHUNK_DATA" },
          { status: 400 }
        );
      }
      const stored = await storeSealStagingChunk({
        userId: user.id,
        uploadId,
        chunkIndex,
        dataB64,
      });
      return NextResponse.json({
        ok: true,
        upload_id: uploadId,
        chunk_index: chunkIndex,
        stored_bytes: stored,
      });
    }

    if (mode === "commit") {
      const uploadId = String(body.upload_id || "").trim();
      const iv = typeof body.iv === "string" ? body.iv.trim() : "";
      const draftIds = parseSealStagingDraftIds(body.draft_ids);
      const totalChunks = Math.max(1, Number(body.total_chunks || 0) || 0);
      if (!uploadId || !iv || !draftIds.length || !totalChunks) {
        return NextResponse.json(
          { error: "Missing commit fields.", error_code: "MISSING_COMMIT_DATA" },
          { status: 400 }
        );
      }
      const admin = getSupabaseAdminClient();
      const subscription = await getUserSubscriptionStatus(admin, user.id);
      const maxBytes = resolveSealStagingMaxBytes(subscription.tier === "plus");
      try {
        const ciphertext = await assembleSealStagingCiphertextFromChunks({
          userId: user.id,
          uploadId,
          totalChunks,
        });
        const row = await createSealStagingRecord({
          userId: user.id,
          draftIds,
          ciphertextB64: ciphertext,
          iv,
          maxBytes,
        });
        return NextResponse.json({
          staging_id: row.id,
          expires_at: row.expires_at,
          storage_backend: row.storage_backend,
          byte_size: row.byte_size,
        });
      } catch (error) {
        return stagingErrorResponse(error, user.id, startedAt);
      }
    }

    const draftIds = parseSealStagingDraftIds(body.draft_ids);
    const ciphertext = typeof body.ciphertext === "string" ? body.ciphertext.trim() : "";
    const iv = typeof body.iv === "string" ? body.iv.trim() : "";

    if (!draftIds.length || !ciphertext || !iv) {
      return NextResponse.json(
        { error: "Missing staging data.", error_code: "MISSING_STAGING_DATA" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const subscription = await getUserSubscriptionStatus(admin, user.id);
    const maxBytes = resolveSealStagingMaxBytes(subscription.tier === "plus");
    try {
      const row = await createSealStagingRecord({
        userId: user.id,
        draftIds,
        ciphertextB64: ciphertext,
        iv,
        maxBytes,
      });
      return NextResponse.json({
        staging_id: row.id,
        expires_at: row.expires_at,
        storage_backend: row.storage_backend,
        byte_size: row.byte_size,
      });
    } catch (error) {
      return stagingErrorResponse(error, user.id, startedAt);
    }
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}
