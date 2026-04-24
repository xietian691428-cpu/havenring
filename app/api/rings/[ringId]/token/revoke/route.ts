import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ ringId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limit = await hitRateLimitWithRedisFallback(
      `revoke:${user.id}`,
      5,
      60_000
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
          },
        }
      );
    }

    const { ringId } = await params;
    if (!ringId) {
      return NextResponse.json({ error: "Missing ringId." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { data: revokedRows, error: revokeError } = await admin
      .from("rings")
      .update({ status: "revoked" })
      .eq("id", ringId)
      .eq("owner_id", user.id)
      .eq("status", "active")
      .select("id")
      .limit(1);

    if (revokeError) {
      return NextResponse.json({ error: revokeError.message }, { status: 500 });
    }

    if (revokedRows && revokedRows.length > 0) {
      try {
        await admin.from("ring_events").insert({
          ring_id: revokedRows[0].id,
          actor_user_id: user.id,
          action: "token_revoke",
          metadata: { source: "api", alreadyRevoked: false },
        });
      } catch {}

      return NextResponse.json(
        {
          ringId: revokedRows[0].id,
          revoked: true,
          alreadyRevoked: false,
        },
        { status: 200 }
      );
    }

    // Idempotent path.
    const { data: existing, error: existingError } = await admin
      .from("rings")
      .select("id")
      .eq("id", ringId)
      .eq("owner_id", user.id)
      .eq("status", "revoked")
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      try {
        await admin.from("ring_events").insert({
          ring_id: existing[0].id,
          actor_user_id: user.id,
          action: "token_revoke",
          metadata: { source: "api", alreadyRevoked: true },
        });
      } catch {}

      return NextResponse.json(
        {
          ringId: existing[0].id,
          revoked: true,
          alreadyRevoked: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Ring not found or not owned by user." },
      { status: 404 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
