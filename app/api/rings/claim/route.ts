import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

type ClaimBody = { token?: unknown };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limit = await hitRateLimitWithRedisFallback(
      `claim:${user.id}`,
      20,
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

    const body = (await req.json()) as ClaimBody;
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token || token.length < 16) {
      return NextResponse.json(
        { error: "Invalid token payload." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);
    const admin = getSupabaseAdminClient();

    // First-time claim path.
    const { data: claimedRows, error: claimError } = await admin
      .from("rings")
      .update({
        owner_id: user.id,
        status: "active",
        claimed_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash)
      .eq("status", "unclaimed")
      .is("owner_id", null)
      .select("id")
      .limit(1);

    if (claimError) {
      return NextResponse.json({ error: claimError.message }, { status: 500 });
    }

    if (claimedRows && claimedRows.length > 0) {
      try {
        await admin.from("ring_events").insert({
          ring_id: claimedRows[0].id,
          actor_user_id: user.id,
          action: "claim",
          metadata: { source: "api", alreadyClaimed: false },
        });
      } catch {}

      return NextResponse.json(
        {
          ringId: claimedRows[0].id,
          claimed: true,
          alreadyClaimed: false,
        },
        { status: 200 }
      );
    }

    // Idempotent path: ring already belongs to this user.
    const { data: existingRows, error: existingError } = await admin
      .from("rings")
      .select("id")
      .eq("token_hash", tokenHash)
      .eq("status", "active")
      .eq("owner_id", user.id)
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 }
      );
    }

    if (existingRows && existingRows.length > 0) {
      try {
        await admin.from("ring_events").insert({
          ring_id: existingRows[0].id,
          actor_user_id: user.id,
          action: "claim",
          metadata: { source: "api", alreadyClaimed: true },
        });
      } catch {}

      return NextResponse.json(
        {
          ringId: existingRows[0].id,
          claimed: true,
          alreadyClaimed: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: "Ring cannot be claimed with this token." },
      { status: 404 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
