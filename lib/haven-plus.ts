import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  FREE_RING_LIMIT,
  FREE_STORAGE_GB,
  PLUS_RING_LIMIT,
  PLUS_STORAGE_GB,
  PLUS_TRIAL_DAYS,
  type SubscriptionStatus,
} from "@/lib/subscription";

type AdminClient = SupabaseClient<Database>;

type HavenPlusRow = {
  id: string;
  created_by: string;
  plus_billing_user_id: string | null;
  plus_trial_start: string | null;
  plus_trial_end: string | null;
};

type BillingEntitlementRow = {
  plan: string;
  plus_trial_end: string | null;
  plus_subscription_status: string;
  plus_subscription_end: string | null;
};

export type HavenPlusResolution = {
  havenId: string;
  billingUserId: string | null;
  memberCount: number;
  activeRingCount: number;
  pairActive: boolean;
  isPlus: boolean;
  status: SubscriptionStatus;
};

function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function billingUserStatus(
  billingRow: BillingEntitlementRow | null,
  nowMs = Date.now()
): SubscriptionStatus {
  const subscriptionEndMs = parseTime(billingRow?.plus_subscription_end);
  const userTrialEndMs = parseTime(billingRow?.plus_trial_end);
  const subscriptionActive =
    billingRow?.plus_subscription_status === "active" &&
    (!subscriptionEndMs || subscriptionEndMs > nowMs);
  const userTrialActive = userTrialEndMs > nowMs;
  const isPlus =
    subscriptionActive || userTrialActive || billingRow?.plan === "plus";
  const source = subscriptionActive
    ? "subscription"
    : userTrialActive
      ? "trial"
      : "free";
  const daysLeft = userTrialActive
    ? Math.max(1, Math.ceil((userTrialEndMs - nowMs) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    tier: isPlus ? "plus" : "free",
    source,
    plusTrialEnd: billingRow?.plus_trial_end ?? null,
    plusTrialDaysLeft: daysLeft,
    ringLimit: isPlus ? PLUS_RING_LIMIT : FREE_RING_LIMIT,
    storageGb: isPlus ? PLUS_STORAGE_GB : FREE_STORAGE_GB,
    canSealWithRing: true,
  };
}

function mergeHavenPlusStatus(
  havenTrialEnd: string | null | undefined,
  billingRow: BillingEntitlementRow | null,
  nowMs = Date.now()
): SubscriptionStatus {
  const billingStatus = billingUserStatus(billingRow, nowMs);
  if (billingStatus.tier === "plus" && billingStatus.source === "subscription") {
    return billingStatus;
  }

  const havenTrialEndMs = parseTime(havenTrialEnd);
  const havenTrialActive = havenTrialEndMs > nowMs;
  if (havenTrialActive) {
    const daysLeft = Math.max(
      1,
      Math.ceil((havenTrialEndMs - nowMs) / (24 * 60 * 60 * 1000))
    );
    return {
      tier: "plus",
      source: "trial",
      plusTrialEnd: havenTrialEnd ?? null,
      plusTrialDaysLeft: daysLeft,
      ringLimit: PLUS_RING_LIMIT,
      storageGb: PLUS_STORAGE_GB,
      canSealWithRing: true,
    };
  }

  if (billingStatus.tier === "plus") {
    return billingStatus;
  }

  return {
    tier: "free",
    source: "free",
    plusTrialEnd: null,
    plusTrialDaysLeft: 0,
    ringLimit: FREE_RING_LIMIT,
    storageGb: FREE_STORAGE_GB,
    canSealWithRing: true,
  };
}

export async function getPrimaryHavenIdForUser(
  admin: AdminClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("haven_members")
    .select("haven_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.haven_id ?? null;
}

/** Haven-level Plus: billing user subscription + one trial per Haven. */
export async function resolvePlusForHaven(
  admin: AdminClient,
  havenId: string
): Promise<HavenPlusResolution> {
  const { data: haven, error: havenErr } = await admin
    .from("havens")
    .select("id, created_by, plus_billing_user_id, plus_trial_start, plus_trial_end")
    .eq("id", havenId)
    .maybeSingle();
  if (havenErr) throw havenErr;
  if (!haven?.id) {
    throw new Error("HAVEN_NOT_FOUND");
  }

  const row = haven as HavenPlusRow;
  const billingUserId = row.plus_billing_user_id || row.created_by || null;

  const [{ count: memberCount, error: memberErr }, { count: ringCount, error: ringErr }] =
    await Promise.all([
      admin
        .from("haven_members")
        .select("id", { count: "exact", head: true })
        .eq("haven_id", havenId),
      admin
        .from("user_nfc_rings")
        .select("id", { count: "exact", head: true })
        .eq("haven_id", havenId)
        .eq("is_active", true),
    ]);
  if (memberErr) throw memberErr;
  if (ringErr) throw ringErr;

  let billingRow: BillingEntitlementRow | null = null;
  if (billingUserId) {
    const { data, error } = await admin
      .from("user_entitlements")
      .select("plan, plus_trial_end, plus_subscription_status, plus_subscription_end")
      .eq("user_id", billingUserId)
      .maybeSingle();
    if (error) throw error;
    billingRow = data as BillingEntitlementRow | null;
  }

  const status = mergeHavenPlusStatus(row.plus_trial_end, billingRow);
  const members = memberCount ?? 0;
  const rings = ringCount ?? 0;

  return {
    havenId,
    billingUserId,
    memberCount: members,
    activeRingCount: rings,
    pairActive: members >= 2 && rings >= 2,
    isPlus: status.tier === "plus",
    status,
  };
}

export async function resolvePlusForUser(
  admin: AdminClient,
  userId: string
): Promise<HavenPlusResolution | null> {
  const havenId = await getPrimaryHavenIdForUser(admin, userId);
  if (!havenId) return null;
  return resolvePlusForHaven(admin, havenId);
}

/** One 30-day trial per Haven; sets billing user if unset. */
export async function activatePlusTrialForHaven(
  admin: AdminClient,
  havenId: string,
  billingUserId: string,
  now = new Date()
): Promise<SubscriptionStatus & { trialJustActivated?: boolean }> {
  const { data: haven, error: readErr } = await admin
    .from("havens")
    .select("plus_trial_end, plus_billing_user_id")
    .eq("id", havenId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!haven) throw new Error("HAVEN_NOT_FOUND");

  const hadTrial = parseTime(haven.plus_trial_end) > 0;
  if (!hadTrial) {
    const trialStart = now.toISOString();
    const trialEnd = new Date(
      now.getTime() + PLUS_TRIAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { error: updateErr } = await admin
      .from("havens")
      .update({
        plus_trial_start: trialStart,
        plus_trial_end: trialEnd,
        plus_billing_user_id: haven.plus_billing_user_id || billingUserId,
      })
      .eq("id", havenId);
    if (updateErr) throw updateErr;
  } else if (!haven.plus_billing_user_id && billingUserId) {
    await admin
      .from("havens")
      .update({ plus_billing_user_id: billingUserId })
      .eq("id", havenId);
  }

  const resolved = await resolvePlusForHaven(admin, havenId);
  return {
    ...resolved.status,
    trialJustActivated: !hadTrial,
  };
}

export async function setHavenPlusBillingUser(
  admin: AdminClient,
  havenId: string,
  billingUserId: string,
  requestedByUserId: string
): Promise<HavenPlusResolution> {
  const { data: membership, error: memErr } = await admin
    .from("haven_members")
    .select("id")
    .eq("haven_id", havenId)
    .eq("user_id", requestedByUserId)
    .maybeSingle();
  if (memErr) throw memErr;
  if (!membership) {
    throw new Error("FORBIDDEN");
  }

  const { data: billingMember, error: billMemErr } = await admin
    .from("haven_members")
    .select("id")
    .eq("haven_id", havenId)
    .eq("user_id", billingUserId)
    .maybeSingle();
  if (billMemErr) throw billMemErr;
  if (!billingMember) {
    throw new Error("BILLING_USER_NOT_IN_HAVEN");
  }

  const { error: updateErr } = await admin
    .from("havens")
    .update({ plus_billing_user_id: billingUserId })
    .eq("id", havenId);
  if (updateErr) throw updateErr;

  return resolvePlusForHaven(admin, havenId);
}

/** Shared 50 GB quota key: billing account for the user's Haven. */
export async function resolveCloudQuotaUserId(
  admin: AdminClient,
  userId: string
): Promise<string> {
  const resolved = await resolvePlusForUser(admin, userId);
  return resolved?.billingUserId || userId;
}
