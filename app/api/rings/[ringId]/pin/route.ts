import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ ringId: string }>;
}

type PinBody = { momentId?: unknown };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limit = await hitRateLimitWithRedisFallback(`pin:${user.id}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString() },
        }
      );
    }

    const { ringId } = await params;
    if (!ringId) {
      return NextResponse.json({ error: "Missing ringId." }, { status: 400 });
    }

    const body = (await req.json()) as PinBody;
    const momentId = typeof body.momentId === "string" ? body.momentId.trim() : null;

    const admin = getSupabaseAdminClient();
    const { data: ownedRing, error: ownedRingError } = await admin
      .from("rings")
      .select("id")
      .eq("id", ringId)
      .eq("owner_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (ownedRingError) {
      return NextResponse.json({ error: ownedRingError.message }, { status: 500 });
    }
    if (!ownedRing) {
      return NextResponse.json(
        { error: "Ring not found or not owned by user." },
        { status: 404 }
      );
    }

    if (momentId) {
      const { data: moment, error: momentError } = await admin
        .from("moments")
        .select("id")
        .eq("id", momentId)
        .eq("ring_id", ringId)
        .eq("is_sealed", true)
        .maybeSingle();

      if (momentError) {
        return NextResponse.json({ error: momentError.message }, { status: 500 });
      }
      if (!moment) {
        return NextResponse.json(
          { error: "Moment not found in this ring." },
          { status: 404 }
        );
      }
    }

    const { error: updateError } = await admin
      .from("rings")
      .update({ pinned_moment_id: momentId ?? null })
      .eq("id", ringId)
      .eq("owner_id", user.id)
      .eq("status", "active");

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ringId,
        pinnedMomentId: momentId ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
