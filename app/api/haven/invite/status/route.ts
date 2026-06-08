import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

function hashInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-invite-status",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const inviteCode = (req.nextUrl.searchParams.get("invite") || "").trim();
    if (!inviteCode) {
      return NextResponse.json({ error: "invite query param required." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: invite, error: inviteErr } = await admin
      .from("ring_invites")
      .select("id, haven_id, created_by, expires_at, consumed_at, cancelled_at")
      .eq("invite_hash", hashInvite(inviteCode))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }
    if (invite.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
    }

    const expired = Date.parse(invite.expires_at) <= Date.now();
    const cancelled = Boolean(invite.cancelled_at);
    const consumed = Boolean(invite.consumed_at);

    const { count: activeRingCount, error: countErr } = await admin
      .from("user_nfc_rings")
      .select("id", { count: "exact", head: true })
      .eq("haven_id", invite.haven_id)
      .eq("is_active", true);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    const partnerJoined = (activeRingCount ?? 0) >= 2;

    return NextResponse.json({
      ok: true,
      pending: !expired && !cancelled && !consumed && !partnerJoined,
      expired,
      cancelled,
      consumed,
      partnerJoined,
      activeRingCount: activeRingCount ?? 0,
      expiresAt: invite.expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
