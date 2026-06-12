import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  isSealStagingApiEnabled,
  resolveSealStagingMaxBytes,
} from "@/lib/seal-staging-config";
import { getUserSubscriptionStatus } from "@/lib/subscription";
import { createSealStagingRecord } from "@/lib/seal-staging-server";
import { recordSealStagingTelemetry } from "@/lib/seal-staging-telemetry";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import { parseSealStagingDraftIds } from "@/lib/seal-staging-shared";

type StagingBody = {
  draft_ids?: unknown;
  ciphertext?: unknown;
  iv?: unknown;
};

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
      const code = error instanceof Error ? error.message : "STAGING_CREATE_FAILED";
      if (code === "STAGING_TOO_LARGE") {
        return NextResponse.json(
          { error: "Staging payload too large.", error_code: "STAGING_TOO_LARGE" },
          { status: 413 }
        );
      }
      await recordSealStagingTelemetry(admin, {
        user_id: user.id,
        phase: "create",
        outcome: "error",
        error_code: code,
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Could not create staging.", error_code: code },
        { status: 500 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}
