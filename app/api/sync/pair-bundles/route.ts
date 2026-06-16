import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import { resolveHavenPairScope } from "@/lib/haven-pair-scope";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

/**
 * GET /api/sync/pair-bundles — sealed moment payloads for Pair import (haven members).
 * Ciphertext vault is server-staged JSON at seal; clients re-encrypt locally with the haven key.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "sync-pair-bundles",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const admin = getSupabaseAdminClient();
    const scope = await resolveHavenPairScope(admin, user.id);

    if (!scope.havenIds.length || !scope.ringIds.length) {
      return NextResponse.json({
        bundles: [],
        pairActive: scope.pairActive,
        havenIds: scope.havenIds,
      });
    }

    const since = req.nextUrl.searchParams.get("since");
    let query = admin
      .from("moments")
      .select(
        "id, ring_id, haven_id, created_by_user_id, encrypted_vault, iv, is_sealed, created_at, release_at, content_sha256"
      )
      .in("haven_id", scope.havenIds)
      .eq("is_sealed", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (since) {
      const parsed = Date.parse(since);
      if (Number.isFinite(parsed)) {
        // Strictly after cursor so failed imports can retry the same bundle.
        query = query.gt("created_at", new Date(parsed).toISOString());
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bundles = (data ?? []).map((row) => ({
      ...row,
      owned_by_you: row.created_by_user_id === user.id,
    }));

    return NextResponse.json({
      bundles,
      pairActive: scope.pairActive,
      havenIds: scope.havenIds,
      accessModel: "pair_shared_sealed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
