import type { UserEntitlements } from "./subscriptionTypes";
import {
  FREE_RING_LIMIT,
  FREE_STORAGE_GB,
  PLUS_RING_LIMIT,
  PLUS_STORAGE_GB,
} from "./subscriptionTypes";

export function getSubscriptionLabel(entitlements: UserEntitlements | null | undefined): string {
  if (!entitlements || entitlements.tier === "free") return "Free";
  if (entitlements.tier === "trial") {
    const d = Math.max(0, entitlements.trialDaysRemaining);
    return `Trial: ${d} day${d === 1 ? "" : "s"} left`;
  }
  return "Plus";
}

export function getSubscriptionSummary(
  entitlements: UserEntitlements | null | undefined
): string {
  if (!entitlements || entitlements.tier === "free") {
    return `Free: ${FREE_STORAGE_GB} GB on-device only. Cloud backup is Plus (${PLUS_STORAGE_GB} GB cap).`;
  }
  if (entitlements.tier === "trial") {
    const d = Math.max(0, entitlements.trialDaysRemaining);
    return `Plus trial: ${d} day${d === 1 ? "" : "s"} left. Cloud backup up to ${PLUS_STORAGE_GB} GB (hard cap).`;
  }
  return `Plus: optional cloud backup up to ${PLUS_STORAGE_GB} GB (hard cap). Local memories stay on your device.`;
}

/** Plan badge line (“Haven Plus” / “Trial” / “Free”). */
export function getPlanBadgeLabel(entitlements: UserEntitlements | null | undefined): string {
  if (!entitlements || entitlements.tier === "free") return "Free plan";
  if (entitlements.tier === "trial") return "Haven Plus trial";
  return "Haven Plus";
}

/**
 * When ring slot quota is exhausted: Free vs Plus / Trial upsell or cap notice.
 */
export function getRingSlotLimitUpsellNotice(
  entitlements: UserEntitlements | null | undefined
): string {
  const tier = entitlements?.tier ?? "free";
  if (tier === "free") {
    return `Up to ${PLUS_RING_LIMIT} rings — one per account. Invite someone with their own login instead of sharing yours.`;
  }
  return `You have reached the ring limit: up to ${PLUS_RING_LIMIT} rings, one per account.`;
}
