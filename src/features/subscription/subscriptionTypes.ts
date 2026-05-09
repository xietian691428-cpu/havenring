/**
 * Canonical client entitlement snapshot (product-facing).
 *
 * Distinguished from backend `SubscriptionStatus` in `@/lib/subscription` (`tier`: free | plus only).
 * UI tier adds `"trial"` as a distinct display / gating tier while trial is active.
 */

export const FREE_STORAGE_GB = 2;
export const PLUS_STORAGE_GB = 50;
export const FREE_RING_LIMIT = 1;
export const PLUS_RING_LIMIT = 5;

export type SubscriptionTier = "free" | "plus" | "trial";

export interface UserEntitlements {
  tier: SubscriptionTier;
  isTrial: boolean;
  trialDaysRemaining: number;
  maxRings: number;
  cloudStorageGB: number;
  canSealWithRing: boolean;
  canUseCloudBackup: boolean;
  canFamilyShare: boolean;
  canAiInsights: boolean;
}

/** Bridge shape aligned with `@/lib/subscription` SubscriptionStatus fields. */
export type SubscriptionStatusLike = {
  tier: "free" | "plus";
  source: "free" | "trial" | "subscription";
  plusTrialDaysLeft: number;
  ringLimit: number;
  storageGb: number;
  canSealWithRing: boolean;
};

export function defaultFreeEntitlements(): UserEntitlements {
  return {
    tier: "free",
    isTrial: false,
    trialDaysRemaining: 0,
    maxRings: FREE_RING_LIMIT,
    cloudStorageGB: FREE_STORAGE_GB,
    canSealWithRing: false,
    canUseCloudBackup: false,
    canFamilyShare: false,
    canAiInsights: false,
  };
}

/** Map server / DB subscription rows (plus vs free binary + source). */
export function userEntitlementsFromSubscriptionStatus(
  s: SubscriptionStatusLike
): UserEntitlements {
  const isPlus = s.tier === "plus";
  const isTrialActive = isPlus && s.source === "trial";
  const tier: SubscriptionTier = !isPlus
    ? "free"
    : isTrialActive
      ? "trial"
      : "plus";

  return {
    tier,
    isTrial: isTrialActive,
    trialDaysRemaining: isTrialActive ? Math.max(0, s.plusTrialDaysLeft) : 0,
    maxRings: s.ringLimit,
    cloudStorageGB: s.storageGb,
    canSealWithRing: Boolean(s.canSealWithRing),
    canUseCloudBackup: isPlus,
    canFamilyShare: isPlus,
    canAiInsights: isPlus,
  };
}
