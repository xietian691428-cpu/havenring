import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

type StagingRow = {
  id: string;
  user_id: string;
  draft_ids: unknown;
  ciphertext: string;
  iv: string;
  expires_at: string;
  consumed_at: string | null;
};

async function loadOwnedStaging(id: string, userId: string) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("seal_staging" as never)
    .select("id, user_id, draft_ids, ciphertext, iv, expires_at, consumed_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { row: null as StagingRow | null, error: "lookup_failed" as const };
  return { row: (data as StagingRow | null) ?? null, error: null };
}

function isExpired(row: StagingRow): boolean {
  return Date.parse(String(row.expires_at || "")) <= Date.now();
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "seal-staging-read",
      policy: API_RATE_POLICIES.sealStaging,
    });
    if (limitRes) return limitRes;

    const { row, error } = await loadOwnedStaging(stagingId, user.id);
    if (error || !row) {
      return NextResponse.json(
        { error: "Staging not found.", error_code: "STAGING_NOT_FOUND" },
        { status: 404 }
      );
    }
    if (row.consumed_at || isExpired(row)) {
      return NextResponse.json(
        { error: "Staging expired.", error_code: "STAGING_EXPIRED" },
        { status: 410 }
      );
    }

    return NextResponse.json({
      staging_id: row.id,
      draft_ids: row.draft_ids,
      ciphertext: row.ciphertext,
      iv: row.iv,
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
    await admin
      .from("seal_staging" as never)
      .delete()
      .eq("id", stagingId)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}

