import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function hashInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function hashKeyToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const inviteCode = (req.nextUrl.searchParams.get("invite") || "").trim();
    const keyToken = (req.nextUrl.searchParams.get("kt") || "").trim();

    if (!inviteCode || !keyToken) {
      return NextResponse.json(
        { error: "invite and kt query params required." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await hitRateLimitWithRedisFallback(
      `invite-key:${ip}`,
      40,
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

    const admin = getSupabaseAdminClient();
    const { data: invite, error: inviteErr } = await admin
      .from("ring_invites")
      .select("id, key_package, expires_at, consumed_at, cancelled_at")
      .eq("invite_hash", hashInvite(inviteCode))
      .eq("key_token_hash", hashKeyToken(keyToken))
      .is("cancelled_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }
    if (!invite?.key_package) {
      return NextResponse.json(
        { error: "Invite key not found.", code: "INVITE_KEY_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      keyPackage: invite.key_package,
      consumed: Boolean(invite.consumed_at),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
