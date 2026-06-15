import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";
import {
  activatePlusTrialForHaven,
  getPrimaryHavenIdForUser,
  resolvePlusForHaven,
  resolvePlusForUser,
} from "./haven-plus";

export const FREE_STORAGE_GB = 2;
export const PLUS_STORAGE_GB = 50;
export const FREE_RING_LIMIT = 2;
export const PLUS_RING_LIMIT = 2;
export const PLUS_TRIAL_DAYS = 30;

type EntitlementRow = Database["public"]["Tables"]["user_entitlements"]["Row"];

export type SubscriptionStatus = {
  tier: "free" | "plus";
  source: "free" | "trial" | "subscription";
  plusTrialEnd: string | null;
  plusTrialDaysLeft: number;
  ringLimit: number;
  storageGb: number;
  canSealWithRing: boolean;
  trialJustActivated?: boolean;
};

function parseTime(value: string | null | undefined) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function getSubscriptionStatusFromEntitlement(
  row: Pick<
    EntitlementRow,
    "plan" | "plus_trial_end" | "plus_subscription_status" | "plus_subscription_end"
  > | null,
  nowMs = Date.now()
): SubscriptionStatus {
  const trialEndMs = parseTime(row?.plus_trial_end);
  const subscriptionEndMs = parseTime(row?.plus_subscription_end);
  const trialActive = trialEndMs > nowMs;
  const subscriptionActive =
    row?.plus_subscription_status === "active" &&
    (!subscriptionEndMs || subscriptionEndMs > nowMs);
  const isPlus = subscriptionActive || trialActive || row?.plan === "plus";
  const source = subscriptionActive ? "subscription" : trialActive ? "trial" : "free";
  const daysLeft = trialActive
    ? Math.max(1, Math.ceil((trialEndMs - nowMs) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    tier: isPlus ? "plus" : "free",
    source,
    plusTrialEnd: row?.plus_trial_end ?? null,
    plusTrialDaysLeft: daysLeft,
    ringLimit: isPlus ? PLUS_RING_LIMIT : FREE_RING_LIMIT,
    storageGb: isPlus ? PLUS_STORAGE_GB : FREE_STORAGE_GB,
    canSealWithRing: true,
  };
}

export async function getUserSubscriptionStatus(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const resolved = await resolvePlusForUser(supabase, userId);
  if (resolved) {
    return resolved.status;
  }

  const { data, error } = await supabase
    .from("user_entitlements")
    .select("plan, plus_trial_end, plus_subscription_status, plus_subscription_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return getSubscriptionStatusFromEntitlement(data);
}

export async function getUserSubscriptionContext(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const resolved = await resolvePlusForUser(supabase, userId);
  if (resolved) {
    return {
      subscription: resolved.status,
      havenPlus: {
        havenId: resolved.havenId,
        billingUserId: resolved.billingUserId,
        isBillingAccount: resolved.billingUserId === userId,
        pairActive: resolved.pairActive,
        memberCount: resolved.memberCount,
      },
    };
  }

  const subscription = await getUserSubscriptionStatus(supabase, userId);
  return {
    subscription,
    havenPlus: null,
  };
}

export async function activatePlusTrialForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date()
) {
  const havenId = await getPrimaryHavenIdForUser(supabase, userId);
  if (havenId) {
    return activatePlusTrialForHaven(supabase, havenId, userId, now);
  }

  const trialStart = now.toISOString();
  const trialEnd = new Date(
    now.getTime() + PLUS_TRIAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: existing, error: readError } = await supabase
    .from("user_entitlements")
    .select("plus_trial_end, plus_subscription_status, plus_subscription_end, plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  const hasExistingTrial = parseTime(existing?.plus_trial_end) > 0;
  const nextTrialEnd = hasExistingTrial ? existing?.plus_trial_end ?? trialEnd : trialEnd;
  const nextTrialStart = hasExistingTrial ? undefined : trialStart;

  const payload = {
    user_id: userId,
    plan: existing?.plan ?? "free",
    plus_trial_end: nextTrialEnd,
    plus_subscription_status: existing?.plus_subscription_status ?? "none",
    plus_subscription_end: existing?.plus_subscription_end ?? null,
    updated_at: trialStart,
    ...(nextTrialStart ? { plus_trial_start: nextTrialStart } : {}),
  };

  const { data, error } = await supabase
    .from("user_entitlements")
    .upsert(payload, { onConflict: "user_id" })
    .select("plan, plus_trial_end, plus_subscription_status, plus_subscription_end")
    .single();
  if (error) throw error;
  return {
    ...getSubscriptionStatusFromEntitlement(data),
    trialJustActivated: !hasExistingTrial,
  };
}

/** @deprecated Prefer activatePlusTrialForHaven — kept for imports. */
export { activatePlusTrialForHaven } from "./haven-plus";
