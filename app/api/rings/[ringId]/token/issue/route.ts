import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ ringId: string }>;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function buildHubUrl(req: NextRequest, token: string): string {
  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  const origin = appOrigin?.trim() || req.nextUrl.origin;
  const url = new URL("/hub", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limit = await hitRateLimitWithRedisFallback(
      `issue:${user.id}`,
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

    // 32-byte random token, base64url-encoded.
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("rings")
      .update({
        token_hash: tokenHash,
        status: "active",
      })
      .eq("id", ringId)
      .eq("owner_id", user.id)
      .eq("status", "active")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Ring not found or not eligible for token rotation." },
        { status: 404 }
      );
    }

    try {
      await admin.from("ring_events").insert({
        ring_id: data[0].id,
        actor_user_id: user.id,
        action: "token_issue",
        metadata: { source: "api" },
      });
    } catch {}

    return NextResponse.json(
      {
        ringId: data[0].id,
        token,
        hubUrl: buildHubUrl(req, token),
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
