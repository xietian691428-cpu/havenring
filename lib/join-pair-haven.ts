import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hashNfcUidAliases, normalizeNfcUidInput } from "@/lib/nfc-uid";
import { resolvePlusForHaven } from "@/lib/haven-plus";
import { getUserSubscriptionStatus } from "@/lib/subscription";

type AdminClient = SupabaseClient<Database>;

export class JoinPairError extends Error {
  code: string;
  status: number;
  ringLimit?: number;

  constructor(message: string, code: string, status: number, ringLimit?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.ringLimit = ringLimit;
  }
}

function sha256(input: string) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

type ActiveRingRow = {
  id: string;
  user_id: string;
  haven_id: string;
  nfc_uid_hash: string;
  nickname: string;
  bound_at: string;
  last_used_at: string | null;
  is_active: boolean;
};

export type JoinPairSuccess = {
  havenId: string;
  role: "member";
  ring: ActiveRingRow;
  joinedExistingRing: true;
  plusTrialActivated: boolean;
  plusTrialEnd: string | null;
  subscription: Awaited<ReturnType<typeof resolvePlusForHaven>>["status"] | null;
};

/**
 * Move the user's solo Haven ring into a partner's Haven via invite.
 * Used when the partner account already linked a ring before accepting the invite.
 */
export async function joinExistingRingToInviteHaven(
  admin: AdminClient,
  userId: string,
  inviteCode: string,
  rawUid?: string
): Promise<JoinPairSuccess> {
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
    throw new JoinPairError(inviteErr.message, "INVITE_LOOKUP_FAILED", 500);
  }
  if (!invite?.haven_id) {
    throw new JoinPairError(
      "Invite is invalid or expired.",
      "INVALID_INVITE",
      403
    );
  }
  const inviteHavenId = invite.haven_id;
  if (invite.created_by === userId) {
    throw new JoinPairError(
      "Invite must be accepted on a separate account.",
      "INVITE_REQUIRES_SEPARATE_ACCOUNT",
      409
    );
  }

  const subscription = await getUserSubscriptionStatus(admin, userId).catch(() => null);
  const ringLimit = subscription?.ringLimit ?? 2;

  const { data: userRings, error: userRingErr } = await admin
    .from("user_nfc_rings")
    .select(
      "id, user_id, haven_id, nfc_uid_hash, nickname, bound_at, last_used_at, is_active"
    )
    .eq("user_id", userId)
    .eq("is_active", true);

  if (userRingErr) {
    throw new JoinPairError(userRingErr.message, "RING_LOOKUP_FAILED", 500);
  }

  const activeRing = (userRings ?? [])[0] as ActiveRingRow | undefined;
  if (!activeRing?.id || !activeRing.haven_id) {
    throw new JoinPairError(
      "Link your ring first, or tap an unlinked ring after opening the invite.",
      "NO_ACTIVE_RING",
      409
    );
  }
  if ((userRings?.length ?? 0) > 1) {
    throw new JoinPairError(
      "Each account can link one active ring.",
      "RING_LIMIT_REACHED",
      409,
      1
    );
  }

  const normalizedUid = rawUid ? normalizeNfcUidInput(rawUid) : "";
  if (normalizedUid) {
    const uidHashCandidates = hashNfcUidAliases(rawUid!);
    if (!uidHashCandidates.includes(activeRing.nfc_uid_hash)) {
      throw new JoinPairError(
        "This ring is not the one linked to your account.",
        "JOIN_UID_MISMATCH",
        409
      );
    }
  }

  if (activeRing.haven_id === invite.haven_id) {
    const { error: memberErr } = await admin.from("haven_members").upsert(
      {
        haven_id: invite.haven_id,
        user_id: userId,
        role: "member",
      },
      { onConflict: "haven_id,user_id" }
    );
    if (memberErr) {
      throw new JoinPairError(memberErr.message, "MEMBER_UPSERT_FAILED", 500);
    }

    const { error: consumeErr } = await admin
      .from("ring_invites")
      .update({ consumed_by: userId, consumed_at: new Date().toISOString() })
      .eq("id", invite.id)
      .is("consumed_at", null)
      .is("cancelled_at", null);
    if (consumeErr) {
      throw new JoinPairError(consumeErr.message, "INVITE_CONSUME_FAILED", 500);
    }

    const resolved = await resolvePlusForHaven(admin, invite.haven_id).catch(() => null);
    return {
      havenId: invite.haven_id,
      role: "member",
      ring: activeRing,
      joinedExistingRing: true,
      plusTrialActivated: false,
      plusTrialEnd: resolved?.status.plusTrialEnd ?? null,
      subscription: resolved?.status ?? null,
    };
  }

  const soloHavenId = activeRing.haven_id;
  const ringId = activeRing.id;

  const { count: soloMemberCount, error: soloMemberErr } = await admin
    .from("haven_members")
    .select("id", { count: "exact", head: true })
    .eq("haven_id", soloHavenId);
  if (soloMemberErr) {
    throw new JoinPairError(soloMemberErr.message, "SOLO_MEMBER_COUNT_FAILED", 500);
  }
  if ((soloMemberCount ?? 0) !== 1) {
    throw new JoinPairError(
      "Your ring is already in a shared Haven. Retire is not available for transfer — contact support if this is unexpected.",
      "JOIN_NOT_SOLO_HAVEN",
      409
    );
  }

  const { count: soloRingCount, error: soloRingErr } = await admin
    .from("user_nfc_rings")
    .select("id", { count: "exact", head: true })
    .eq("haven_id", soloHavenId)
    .eq("is_active", true);
  if (soloRingErr) {
    throw new JoinPairError(soloRingErr.message, "SOLO_RING_COUNT_FAILED", 500);
  }
  if ((soloRingCount ?? 0) !== 1) {
    throw new JoinPairError(
      "Your Haven already has more than one ring.",
      "JOIN_NOT_SOLO_HAVEN",
      409
    );
  }

  const { count: targetRingCount, error: targetRingErr } = await admin
    .from("user_nfc_rings")
    .select("id", { count: "exact", head: true })
    .eq("haven_id", invite.haven_id)
    .eq("is_active", true);
  if (targetRingErr) {
    throw new JoinPairError(targetRingErr.message, "TARGET_RING_COUNT_FAILED", 500);
  }
  if ((targetRingCount ?? 0) >= ringLimit) {
    throw new JoinPairError(
      "This Haven already has two active rings.",
      "HAVEN_PAIR_FULL",
      409,
      ringLimit
    );
  }

  const { error: memberErr } = await admin.from("haven_members").upsert(
    {
      haven_id: invite.haven_id,
      user_id: userId,
      role: "member",
    },
    { onConflict: "haven_id,user_id" }
  );
  if (memberErr) {
    throw new JoinPairError(memberErr.message, "MEMBER_UPSERT_FAILED", 500);
  }

  async function rollbackPartialJoin() {
    await admin
      .from("user_nfc_rings")
      .update({ haven_id: soloHavenId })
      .eq("id", ringId)
      .eq("user_id", userId);
    await admin.from("rings").update({ haven_id: soloHavenId }).eq("id", ringId);
    await admin
      .from("haven_members")
      .delete()
      .eq("haven_id", inviteHavenId)
      .eq("user_id", userId);
  }

  const { data: movedRing, error: moveErr } = await admin
    .from("user_nfc_rings")
    .update({ haven_id: inviteHavenId })
    .eq("id", ringId)
    .eq("user_id", userId)
    .select(
      "id, user_id, haven_id, nfc_uid_hash, nickname, bound_at, last_used_at, is_active"
    )
    .single();
  if (moveErr || !movedRing) {
    await rollbackPartialJoin().catch(() => null);
    throw new JoinPairError(
      moveErr?.message || "Could not move ring into partner Haven.",
      "RING_MOVE_FAILED",
      500
    );
  }

  const { error: mirrorErr } = await admin
    .from("rings")
    .update({ haven_id: inviteHavenId })
    .eq("id", ringId);
  if (mirrorErr) {
    await rollbackPartialJoin().catch(() => null);
    throw new JoinPairError(mirrorErr.message, "RING_MIRROR_FAILED", 500);
  }

  const { error: leaveErr } = await admin
    .from("haven_members")
    .delete()
    .eq("haven_id", soloHavenId)
    .eq("user_id", userId);
  if (leaveErr) {
    await rollbackPartialJoin().catch(() => null);
    throw new JoinPairError(leaveErr.message, "MEMBER_LEAVE_FAILED", 500);
  }

  const { error: consumeErr } = await admin
    .from("ring_invites")
    .update({ consumed_by: userId, consumed_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("consumed_at", null)
    .is("cancelled_at", null);
  if (consumeErr) {
    throw new JoinPairError(consumeErr.message, "INVITE_CONSUME_FAILED", 500);
  }

  const resolved = await resolvePlusForHaven(admin, invite.haven_id).catch(() => null);

  return {
    havenId: invite.haven_id,
    role: "member",
    ring: movedRing as ActiveRingRow,
    joinedExistingRing: true,
    plusTrialActivated: false,
    plusTrialEnd: resolved?.status.plusTrialEnd ?? null,
    subscription: resolved?.status ?? null,
  };
}
