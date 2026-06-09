import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import {
  consumeSealStagingById,
  loadSealStagingRow,
  resolveSealStagingCiphertext,
} from "@/lib/seal-staging-server";
import { recordSealStagingTelemetry } from "@/lib/seal-staging-telemetry";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

function isExpired(expiresAt: string): boolean {
  return Date.parse(String(expiresAt || "")) <= Date.now();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const { id } = await ctx.params;
    const stagingId = String(id || "").trim();
    if (!stagingId) {
      return NextResponse.json(
        { error: "Missing staging id.", error_code: "MISSING_STAGING_ID" },
        { status: 400 }
      );
    }
    const limitRes = await enforceUserRateLimit({
      userId: user.id,
      scope: "seal-staging-read",
      policy: API_RATE_POLICIES.sealStagingRead,
    });
    if (limitRes) return limitRes;

    const admin = getSupabaseAdminClient();
    const row = await loadSealStagingRow(stagingId, user.id);
    if (!row) {
      return NextResponse.json(
        { error: "Staging not found.", error_code: "STAGING_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (row.consumed_at || isExpired(row.expires_at)) {
      return NextResponse.json(
        { error: "Staging expired.", error_code: "STAGING_EXPIRED" },
        { status: 410 }
      );
    }

    const delivery = await resolveSealStagingCiphertext(row);
    await recordSealStagingTelemetry(admin, {
      user_id: user.id,
      phase: "read",
      outcome: "success",
      storage_backend: row.storage_backend,
      byte_size: row.byte_size,
      latency_ms: Date.now() - startedAt,
    });

    return NextResponse.json({
      staging_id: row.id,
      draft_ids: row.draft_ids,
      iv: row.iv,
      byte_size: row.byte_size,
      storage_backend: row.storage_backend,
      delivery: delivery.delivery,
      ciphertext: delivery.ciphertext,
      signed_url: delivery.signed_url,
      expires_at: row.expires_at,
    });
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const { id } = await ctx.params;
    const stagingId = String(id || "").trim();
    if (!stagingId) {
      return NextResponse.json(
        { error: "Missing staging id.", error_code: "MISSING_STAGING_ID" },
        { status: 400 }
      );
    }
    const admin = getSupabaseAdminClient();
    await consumeSealStagingById(stagingId, user.id);
    await recordSealStagingTelemetry(admin, {
      user_id: user.id,
      phase: "delete",
      outcome: "success",
      latency_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}
