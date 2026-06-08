import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

/**
 * GET /api/sync/moments — sealed-moment metadata for the signed-in Haven member.
 * Server-side fetch avoids brittle client RLS / VPN issues on the timeline sync banner.
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

    const ringIds = req.nextUrl.searchParams
      .get("ring_ids")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const admin = getSupabaseAdminClient();
    const { data: memberships, error: membershipErr } = await admin
      .from("haven_members")
      .select("haven_id")
      .eq("user_id", user.id);

    if (membershipErr) {
      return NextResponse.json({ error: membershipErr.message }, { status: 500 });
    }

    const havenIds = [
      ...new Set((memberships ?? []).map((row) => row.haven_id).filter(Boolean)),
    ];
    if (!havenIds.length) {
      return NextResponse.json({ moments: [] });
    }

    let query = admin
      .from("moments")
      .select("id, ring_id, created_at, release_at, content_sha256, is_sealed")
      .in("haven_id", havenIds)
      .order("created_at", { ascending: false })
      .limit(200);

    if (ringIds?.length) {
      query = query.in("ring_id", ringIds);
    }

    const { data, error } = await query;
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
