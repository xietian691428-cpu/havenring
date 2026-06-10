import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseUserClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import { requireSecondaryVerificationToken } from "@/lib/secondary-verification";

/**
 * POST /api/nfc/revoke-all — retire every NFC ring binding for the user.
 * Retired rings are not released for transfer to another account/Haven.
 * Same contract as /api/nfc/revoke: requires secondary verification token
 * and explicit privacy acknowledgment.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);

    const secondaryRes = await requireSecondaryVerificationToken(req, user.id);
    if (secondaryRes) return secondaryRes;

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "nfc-revoke-all",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as {
      privacy_acknowledged?: unknown;
    };
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
        retired_at: new Date().toISOString(),
        retired_reason: "user_retired_all",
      })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      revoked_count: data?.length ?? 0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
