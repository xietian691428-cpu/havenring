import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import { inviterDisplayNameFromMetadata } from "@/lib/inviter-display-name";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function hashInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

/**
 * GET /api/haven/invite/preview?invite=…
 * Public, minimal context for the partner join screen (no auth required).
 */
export async function GET(req: NextRequest) {
  try {
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: "invite-preview",
      scope: "haven-invite-preview",
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
    if (!invite?.haven_id) {
      return NextResponse.json({
        valid: false,
        expired: true,
        alreadyComplete: false,
        inviterName: "your partner",
      });
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

    const alreadyComplete = (activeRingCount ?? 0) >= 2;
    const valid = !expired && !cancelled && !consumed && !alreadyComplete;

    let inviterName = "your partner";
    if (invite.created_by) {
      const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
        invite.created_by
      );
      if (!authErr && authUser?.user) {
        inviterName = inviterDisplayNameFromMetadata(
          authUser.user.user_metadata as Record<string, unknown>
        );
      }
    }

    return NextResponse.json({
      valid,
      expired: expired || cancelled,
      alreadyComplete,
      consumed,
      inviterName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
