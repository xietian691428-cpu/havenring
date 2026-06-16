import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  isAnonymousUser,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type InviteBody = { haven_id?: unknown };
type RevokeInviteBody = { invite_code?: unknown };

function hashInvite(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Sign in to create a legacy second-ring invite.", code: "AUTH_REQUIRED" },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-invite",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as InviteBody;
    const requestedHavenId =
      typeof body.haven_id === "string" ? body.haven_id.trim() : "";
    const admin = getSupabaseAdminClient();

    let havenId = requestedHavenId;
    if (!havenId) {
      const { data: membership, error: membershipErr } = await admin
        .from("haven_members")
        .select("haven_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (membershipErr) {
        return NextResponse.json({ error: membershipErr.message }, { status: 500 });
      }
      havenId = membership?.haven_id || "";
    }

    if (!havenId) {
      return NextResponse.json(
        { error: "Bind your ring first.", code: "NO_HAVEN" },
        { status: 409 }
      );
    }

    const { data: member, error: memberErr } = await admin
      .from("haven_members")
      .select("id")
      .eq("haven_id", havenId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { count: activeRingCount, error: countErr } = await admin
      .from("user_nfc_rings")
      .select("id", { count: "exact", head: true })
      .eq("haven_id", havenId)
      .eq("is_active", true);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((activeRingCount ?? 0) >= 2) {
      return NextResponse.json(
        { error: "This Haven already has two active rings.", code: "HAVEN_PAIR_FULL" },
        { status: 409 }
      );
    }

    const { error: cancelStaleErr } = await admin
      .from("ring_invites")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("haven_id", havenId)
      .is("consumed_at", null)
      .is("cancelled_at", null);
    if (cancelStaleErr) {
      return NextResponse.json({ error: cancelStaleErr.message }, { status: 500 });
    }

    const inviteCode = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: insertErr } = await admin.from("ring_invites").insert({
      haven_id: havenId,
      created_by: user.id,
      invite_hash: hashInvite(inviteCode),
      expires_at: expiresAt,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      havenId,
      inviteCode,
      expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-invite-revoke",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as RevokeInviteBody;
    const inviteCode = typeof body.invite_code === "string" ? body.invite_code.trim() : "";
    if (!inviteCode) {
      return NextResponse.json({ error: "invite_code required." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const inviteHash = hashInvite(inviteCode);
    const { data: invite, error: inviteErr } = await admin
      .from("ring_invites")
      .select("id, haven_id, created_by, consumed_at, cancelled_at")
      .eq("invite_hash", inviteHash)
      .maybeSingle();
    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    const { data: member, error: memberErr } = await admin
      .from("haven_members")
      .select("id, role")
      .eq("haven_id", invite.haven_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }
    if (!member || (member.role !== "owner" && invite.created_by !== user.id)) {
      return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
    }

    if (invite.consumed_at || invite.cancelled_at) {
      return NextResponse.json({ ok: true, alreadyClosed: true });
    }

    const { error } = await admin
      .from("ring_invites")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("consumed_at", null)
      .is("cancelled_at", null);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
