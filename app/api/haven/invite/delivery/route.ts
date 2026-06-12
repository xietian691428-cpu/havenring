import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  isAnonymousUser,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type DeliveryBody = {
  invite_code?: unknown;
  key_package?: unknown;
};

function hashInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function hashKeyToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Sign in to send a legacy second-ring invite." },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-invite-delivery",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as DeliveryBody;
    const inviteCode =
      typeof body.invite_code === "string" ? body.invite_code.trim() : "";
    const keyPackage =
      typeof body.key_package === "string" ? body.key_package.trim() : "";

    if (!inviteCode || inviteCode.length < 16) {
      return NextResponse.json({ error: "invite_code required." }, { status: 400 });
    }
    if (!keyPackage || keyPackage.length < 32) {
      return NextResponse.json({ error: "key_package required." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const inviteHash = hashInvite(inviteCode);
    const { data: invite, error: inviteErr } = await admin
      .from("ring_invites")
      .select("id, haven_id, created_by, expires_at, consumed_at, cancelled_at")
      .eq("invite_hash", inviteHash)
      .is("consumed_at", null)
      .is("cancelled_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json(
        { error: "Invite is invalid or expired.", code: "INVALID_INVITE" },
        { status: 404 }
      );
    }
    if (invite.created_by !== user.id) {
      return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
    }

    const keyToken = randomBytes(16).toString("hex");
    const { error: updateErr } = await admin
      .from("ring_invites")
      .update({
        key_token_hash: hashKeyToken(keyToken),
        key_package: keyPackage,
      })
      .eq("id", invite.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      keyToken,
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
