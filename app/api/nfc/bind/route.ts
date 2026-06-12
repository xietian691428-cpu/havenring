import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hashNfcUidAliases, normalizeNfcUidInput } from "@/lib/nfc-uid";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  isAnonymousUser,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";
import {
  activatePlusTrialForUser,
  getUserSubscriptionStatus,
} from "@/lib/subscription";
import {
  JoinPairError,
  joinExistingRingToInviteHaven,
} from "@/lib/join-pair-haven";
import { requireSecondaryVerificationToken } from "@/lib/secondary-verification";

type BindBody = {
  nfc_uid?: unknown;
  nickname?: unknown;
  invite_code?: unknown;
  privacy_acknowledged?: unknown;
};

function sha256(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * POST /api/nfc/bind
 * Binds a ring UID (hashed server-side) to the authenticated user's Haven.
 * First ring creates a one-person Haven. A second ring must use a short-lived
 * partner invite and a separate authenticated account.
 * Requires: Bearer session, explicit privacy acknowledgment, and a secondary
 * verification token (minted after local device passcode check).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "A full Haven account is required for NFC bind." },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "nfc-bind",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const secondaryRes = await requireSecondaryVerificationToken(req, user.id);
    if (secondaryRes) return secondaryRes;

    const body = (await req.json()) as BindBody;
    const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid : "";
    const normalized = normalizeNfcUidInput(rawUid);
    const inviteCode = String(body.invite_code ?? "").trim();
    if (!normalized && !inviteCode) {
      return NextResponse.json({ error: "Invalid nfc_uid." }, { status: 400 });
    }
    if (body.privacy_acknowledged !== true) {
      return NextResponse.json(
        { error: "privacy_acknowledged must be true." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    if (!normalized && inviteCode) {
      try {
        const joined = await joinExistingRingToInviteHaven(admin, user.id, inviteCode);
        return NextResponse.json({
          success: true,
          joinedExistingRing: true,
          havenId: joined.havenId,
          role: joined.role,
          ring: joined.ring,
          ringId: joined.ring.id,
          message: "Ring linked. Ready for sealing.",
          plusTrialActivated: joined.plusTrialActivated,
          plusTrialEnd: joined.plusTrialEnd,
          subscription: joined.subscription,
        });
      } catch (error) {
        if (error instanceof JoinPairError) {
          return NextResponse.json(
            {
              error: error.message,
              code: error.code,
              ringLimit: error.ringLimit,
            },
            { status: error.status }
          );
        }
        throw error;
      }
    }

    const uidHashCandidates = hashNfcUidAliases(rawUid);
    if (!uidHashCandidates.length) {
      return NextResponse.json({ error: "Invalid nfc_uid." }, { status: 400 });
    }
    const uidHash = uidHashCandidates[0];
    const nickname = String(body.nickname ?? "").trim() || "Ring";

    const { data: existingGlobal, error: existingErr } = await admin
      .from("user_nfc_rings")
      .select("id, user_id, haven_id, nickname, bound_at, last_used_at, is_active, retired_at")
      .in("nfc_uid_hash", uidHashCandidates)
      .order("is_active", { ascending: false })
      .order("bound_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message || "Conflict check failed." },
        { status: 500 }
      );
    }
    if (existingGlobal) {
      if (existingGlobal.user_id === user.id && existingGlobal.is_active) {
        if (inviteCode) {
          try {
            const joined = await joinExistingRingToInviteHaven(
              admin,
              user.id,
              inviteCode,
              rawUid
            );
            return NextResponse.json({
              success: true,
              joinedExistingRing: true,
              alreadyLinkedToYou: true,
              havenId: joined.havenId,
              role: joined.role,
              ring: joined.ring,
              ringId: joined.ring.id,
              message: "Ring linked. Ready for sealing.",
              plusTrialActivated: joined.plusTrialActivated,
              plusTrialEnd: joined.plusTrialEnd,
              subscription: joined.subscription,
            });
          } catch (error) {
            if (error instanceof JoinPairError) {
              return NextResponse.json(
                {
                  error: error.message,
                  code: error.code,
                  ringLimit: error.ringLimit,
                },
                { status: error.status }
              );
            }
            throw error;
          }
        }
        return NextResponse.json({
          success: true,
          alreadyLinkedToYou: true,
          havenId: existingGlobal.haven_id,
          ring: existingGlobal,
          message: "This ring is already linked to your account.",
        });
      }
      if (!existingGlobal.is_active || existingGlobal.retired_at) {
        return NextResponse.json(
          {
            error:
              "This ring was previously activated and cannot be transferred to another Haven.",
            code: "RING_NON_TRANSFERABLE",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "This ring is already linked to another Haven and cannot be transferred.",
          code: "RING_BOUND_TO_OTHER_USER",
        },
        { status: 409 }
      );
    }

    const subscription = await getUserSubscriptionStatus(admin, user.id).catch(() => null);
    const ringLimit = subscription?.ringLimit ?? 2;

    const { data: existingUserRings, error: userRingErr } = await admin
      .from("user_nfc_rings")
      .select("id, haven_id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (userRingErr) {
      return NextResponse.json(
        { error: userRingErr.message || "Count failed." },
        { status: 500 }
      );
    }
    if ((existingUserRings?.length ?? 0) >= 1) {
      if (inviteCode) {
        try {
          const joined = await joinExistingRingToInviteHaven(
            admin,
            user.id,
            inviteCode,
            rawUid
          );
          return NextResponse.json({
            success: true,
            joinedExistingRing: true,
            havenId: joined.havenId,
            role: joined.role,
            ring: joined.ring,
            ringId: joined.ring.id,
            message: "Ring linked. Ready for sealing.",
            plusTrialActivated: joined.plusTrialActivated,
            plusTrialEnd: joined.plusTrialEnd,
            subscription: joined.subscription,
          });
        } catch (error) {
          if (error instanceof JoinPairError) {
            return NextResponse.json(
              {
                error: error.message,
                code: error.code,
                ringLimit: error.ringLimit,
              },
              { status: error.status }
            );
          }
          throw error;
        }
      }
      return NextResponse.json(
        {
          error: "Each account can link one active ring. Invite someone with their own account to add a second ring.",
          code: "RING_LIMIT_REACHED",
          ringLimit: 1,
        },
        { status: 409 }
      );
    }

    let havenId = "";
    let role: "owner" | "member" = "owner";

    if (inviteCode) {
      const inviteHash = sha256(inviteCode);
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
      if (!invite?.haven_id) {
        return NextResponse.json(
          { error: "Invite is invalid or expired.", code: "INVALID_INVITE" },
          { status: 403 }
        );
      }
      if (invite.created_by === user.id) {
        return NextResponse.json(
          {
            error: "Legacy invite must be accepted on a separate account.",
            code: "INVITE_REQUIRES_SEPARATE_ACCOUNT",
          },
          { status: 409 }
        );
      }

      const { count: havenRingCount, error: havenCountErr } = await admin
        .from("user_nfc_rings")
        .select("id", { count: "exact", head: true })
        .eq("haven_id", invite.haven_id)
        .eq("is_active", true);
      if (havenCountErr) {
        return NextResponse.json({ error: havenCountErr.message }, { status: 500 });
      }
      if ((havenRingCount ?? 0) >= ringLimit) {
        return NextResponse.json(
          {
            error: "This Haven already has two active rings.",
            code: "HAVEN_PAIR_FULL",
            ringLimit,
          },
          { status: 409 }
        );
      }

      const { error: memberErr } = await admin
        .from("haven_members")
        .upsert(
          {
            haven_id: invite.haven_id,
            user_id: user.id,
            role: "member",
          },
          { onConflict: "haven_id,user_id" }
        );
      if (memberErr) {
        return NextResponse.json({ error: memberErr.message }, { status: 500 });
      }

      const { error: consumeErr } = await admin
        .from("ring_invites")
        .update({ consumed_by: user.id, consumed_at: new Date().toISOString() })
        .eq("id", invite.id)
        .is("consumed_at", null)
        .is("cancelled_at", null);
      if (consumeErr) {
        return NextResponse.json({ error: consumeErr.message }, { status: 500 });
      }

      havenId = invite.haven_id;
      role = "member";
    } else {
      const { data: existingMembership, error: membershipErr } = await admin
        .from("haven_members")
        .select("haven_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (membershipErr) {
        return NextResponse.json({ error: membershipErr.message }, { status: 500 });
      }

      if (existingMembership?.haven_id) {
        havenId = existingMembership.haven_id;
      } else {
        const { data: haven, error: havenErr } = await admin
          .from("havens")
          .insert({ created_by: user.id })
          .select("id")
          .single();
        if (havenErr || !haven?.id) {
          return NextResponse.json(
            { error: havenErr?.message || "Could not create Haven." },
            { status: 500 }
          );
        }
        havenId = haven.id;
        const { error: ownerErr } = await admin.from("haven_members").insert({
          haven_id: havenId,
          user_id: user.id,
          role: "owner",
        });
        if (ownerErr) {
          return NextResponse.json({ error: ownerErr.message }, { status: 500 });
        }
      }
    }

    const { data, error } = await admin
      .from("user_nfc_rings")
      .insert({
        user_id: user.id,
        haven_id: havenId,
        nfc_uid_hash: uidHash,
        nickname,
        bound_at: new Date().toISOString(),
        is_active: true,
      })
      .select("id, user_id, haven_id, nickname, bound_at, last_used_at, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "This ring was linked in another tab or account. Activated rings cannot be transferred.",
            code: "BIND_CONFLICT",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { error: mirrorErr } = await admin.from("rings").upsert({
      id: data.id,
      haven_id: havenId,
      owner_id: user.id,
      status: "active",
      token_hash: uidHash,
      claimed_at: data.bound_at,
    });
    if (mirrorErr) {
      return NextResponse.json({ error: mirrorErr.message }, { status: 500 });
    }

    const plusTrial = await activatePlusTrialForUser(admin, user.id).catch(() => null);

    return NextResponse.json({
      success: true,
      ringId: data.id,
      havenId,
      role,
      ring: data,
      message:
        role === "member"
          ? "Ring linked. Ready for sealing."
          : "Ring linked. Invite someone with their own account to add a second ring.",
      plusTrialActivated: Boolean(plusTrial?.trialJustActivated),
      plusTrialEnd: plusTrial?.plusTrialEnd ?? null,
      subscription: plusTrial,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
