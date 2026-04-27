import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import {
  getSupabaseAdminClient,
  isAnonymousUser,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

type ClaimBody = { token?: unknown };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeClaimToken(input: unknown): string {
  if (typeof input !== "string") return "";
  const raw = input.trim();
  if (!raw) return "";

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  // Accept plain token directly.
  if (!decoded.includes("token=") && !decoded.includes("?") && !decoded.includes("&")) {
    return decoded.trim();
  }

  // Accept full URLs like https://example.com/hub?token=...
  try {
    const url = new URL(decoded);
    const fromUrl = url.searchParams.get("token");
    if (fromUrl) return fromUrl.trim();
  } catch {}

  // Accept relative/query-ish payloads like /hub?token=... or token=...
  try {
    const queryPart = decoded.includes("?") ? decoded.slice(decoded.indexOf("?") + 1) : decoded;
    const params = new URLSearchParams(queryPart);
    const fromParams = params.get("token");
    if (fromParams) return fromParams.trim();
  } catch {}

  return decoded.trim();
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        {
          error: "Please sign in with a permanent account before claiming this ring.",
          code: "AUTH_UPGRADE_REQUIRED",
        },
        { status: 403 }
      );
    }
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
    const token = normalizeClaimToken(body.token);

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
      .in("status", ["unclaimed", "active"])
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

    const { data: ringRows, error: ringLookupError } = await admin
      .from("rings")
      .select("id,status,owner_id")
      .eq("token_hash", tokenHash)
      .limit(1);

    if (ringLookupError) {
      return NextResponse.json(
        { error: ringLookupError.message, code: "LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (!ringRows || ringRows.length === 0) {
      return NextResponse.json(
        {
          error: "This ring token is invalid or no longer available.",
          code: "TOKEN_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const ring = ringRows[0] as { id: string; status: string; owner_id: string | null };
    if (ring.status === "revoked") {
      return NextResponse.json(
        {
          error: "This ring has been revoked and cannot be claimed.",
          code: "RING_REVOKED",
        },
        { status: 410 }
      );
    }

    if (ring.owner_id && ring.owner_id !== user.id) {
      return NextResponse.json(
        {
          error: "This ring is already linked to another account.",
          code: "RING_OWNED_BY_ANOTHER",
        },
        { status: 409 }
      );
    }

    if (ring.owner_id === user.id) {
      return NextResponse.json(
        {
          ringId: ring.id,
          claimed: true,
          alreadyClaimed: true,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        error: "Ring is in an unsupported state for claim.",
        code: "RING_CLAIM_STATE_UNSUPPORTED",
      },
      { status: 409 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
