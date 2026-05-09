import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export const FREE_STORAGE_GB = 2;
export const PLUS_STORAGE_GB = 50;
export const FREE_RING_LIMIT = 1;
export const PLUS_RING_LIMIT = 5;
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
    canSealWithRing: isPlus,
  };
}

export async function getUserSubscriptionStatus(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("plan, plus_trial_end, plus_subscription_status, plus_subscription_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return getSubscriptionStatusFromEntitlement(data);
}

export async function activatePlusTrialForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  now = new Date()
) {
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
