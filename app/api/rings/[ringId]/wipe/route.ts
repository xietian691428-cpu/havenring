import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  getSupabaseUserClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ ringId: string }>;
}

type WipeBody = { token?: unknown };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const accessToken = requireBearerToken(req);
    const limit = await hitRateLimitWithRedisFallback(`wipe:${user.id}`, 3, 60_000);
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

    const body = (await req.json()) as WipeBody;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Missing ring token." }, { status: 400 });
    }

    // Execute wipe with user-scoped auth so RPC's auth.uid() checks apply.
    const userClient = getSupabaseUserClient(accessToken);
    const { error: wipeError } = await userClient.rpc("wipe_ring", {
      p_ring_id: ringId,
      p_token: token,
    });

    if (wipeError) {
      const status = wipeError.code === "42501" ? 403 : 500;
      return NextResponse.json({ error: wipeError.message }, { status });
    }

    // Best-effort audit event.
    try {
      const admin = getSupabaseAdminClient();
      await admin.from("ring_events").insert({
        ring_id: ringId,
        actor_user_id: user.id,
        action: "wipe",
        metadata: { source: "api" },
      });
    } catch {}

    return NextResponse.json({ ringId, wiped: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
