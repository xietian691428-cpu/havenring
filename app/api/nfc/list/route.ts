import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

/**
 * GET /api/nfc/list — active NFC ring bindings visible to the signed-in account.
 * Pair model: lists both rings in the user's haven (yours + partner's).
 * Seal uses your ring only; sealed memories sync within the Pair.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "nfc-list",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;
    const admin = getSupabaseAdminClient();

    const { data: memberships, error: membershipErr } = await admin
      .from("haven_members")
      .select("haven_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membershipErr) {
      return NextResponse.json({ error: membershipErr.message }, { status: 500 });
    }

    const havenIds = [...new Set((memberships ?? []).map((row) => row.haven_id).filter(Boolean))];
    if (!havenIds.length) {
      return NextResponse.json({ rings: [], havens: [] });
    }

    const { data, error } = await admin
      .from("user_nfc_rings")
      .select(
        "id, user_id, haven_id, nfc_uid_hash, nickname, bound_at, last_used_at, is_active, created_at, retired_at, retired_reason"
      )
      .in("haven_id", havenIds)
      .eq("is_active", true)
      .order("bound_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rings: (data ?? []).map((ring) => ({
        ...ring,
        ownedByYou: ring.user_id === user.id,
        pairPartnerRing: ring.user_id !== user.id,
        legacyPairRing: ring.user_id !== user.id,
      })),
      havens: memberships ?? [],
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
