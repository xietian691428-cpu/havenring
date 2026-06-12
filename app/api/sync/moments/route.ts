import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

/**
 * GET /api/sync/moments — sealed-moment metadata for the signed-in account.
 * Phase 5: personal-first (owner rings only). Legacy haven-wide reads removed.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "sync-moments",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const ringIdsParam = req.nextUrl.searchParams
      .get("ring_ids")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const admin = getSupabaseAdminClient();
    const { data: ownedRings, error: ringsErr } = await admin
      .from("user_nfc_rings")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (ringsErr) {
      return NextResponse.json({ error: ringsErr.message }, { status: 500 });
    }

    const ownedRingIds = (ownedRings ?? []).map((row) => row.id).filter(Boolean);
    if (!ownedRingIds.length) {
      return NextResponse.json({ moments: [] });
    }

    const scopedRingIds = ringIdsParam?.length
      ? ringIdsParam.filter((id) => ownedRingIds.includes(id))
      : ownedRingIds;

    if (!scopedRingIds.length) {
      return NextResponse.json({ moments: [] });
    }

    const { data, error } = await admin
      .from("moments")
      .select("id, ring_id, created_at, release_at, content_sha256, is_sealed")
      .in("ring_id", scopedRingIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ moments: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
