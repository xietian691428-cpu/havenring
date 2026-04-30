import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseUserClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

type RevokeBody = { ring_id?: unknown; privacy_acknowledged?: unknown };

/**
 * POST /api/nfc/revoke — soft-revoke a binding (is_active = false).
 * Requires secondary verification header (same contract as bind).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);

    const secondary = req.headers.get("x-haven-secondary-verified");
    if (secondary !== "1") {
      return NextResponse.json(
        {
          error: "Secondary verification required.",
          code: "secondary_verification_required",
        },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "nfc-revoke",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json()) as RevokeBody;
    const ringId = typeof body.ring_id === "string" ? body.ring_id : "";
    if (!ringId) {
      return NextResponse.json({ error: "ring_id required." }, { status: 400 });
    }
    if (body.privacy_acknowledged !== true) {
      return NextResponse.json(
        { error: "privacy_acknowledged must be true." },
        { status: 400 }
      );
    }

    const accessToken = requireBearerToken(req);
    const supabase = getSupabaseUserClient(accessToken);

    const { data, error } = await supabase
      .from("user_nfc_rings")
      .update({
        is_active: false,
      })
      .eq("id", ringId)
      .eq("user_id", user.id)
      .select("id, is_active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Ring not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, ring: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
