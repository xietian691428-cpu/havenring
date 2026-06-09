import { NextRequest, NextResponse } from "next/server";
import {
  hashSealStagingContent,
  parseSealStagingDraftIds,
  sealStagingExpiryIso,
  SEAL_STAGING_MAX_CIPHERTEXT_BYTES,
} from "@/lib/seal-staging-shared";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

type StagingBody = {
  draft_ids?: unknown;
  ciphertext?: unknown;
  iv?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "seal-staging-create",
      policy: API_RATE_POLICIES.sealStaging,
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
    if (ciphertext.length > SEAL_STAGING_MAX_CIPHERTEXT_BYTES) {
      return NextResponse.json(
        { error: "Staging payload too large.", error_code: "STAGING_TOO_LARGE" },
        { status: 413 }
      );
    }

    const expiresAt = sealStagingExpiryIso();
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("seal_staging" as never)
      .insert({
        user_id: user.id,
        draft_ids: draftIds,
        ciphertext,
        iv,
        content_sha256: hashSealStagingContent(ciphertext),
        expires_at: expiresAt,
      } as never)
      .select("id, expires_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Could not create staging.", error_code: "STAGING_CREATE_FAILED" },
        { status: 500 }
      );
    }

    const row = data as { id: string; expires_at: string };
    return NextResponse.json({
      staging_id: row.id,
      expires_at: row.expires_at,
    });
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}
