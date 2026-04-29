import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseUserClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

/**
 * POST /api/nfc/revoke-all — deactivate every NFC ring binding for the user.
 * Same contract as /api/nfc/revoke: requires secondary verification header
 * and explicit privacy acknowledgment.
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

    const limit = await hitRateLimitWithRedisFallback(
      `nfc-revoke-all:${user.id}`,
      5,
      60_000
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 }
      );
    }

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
      .update({ is_active: false })
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
