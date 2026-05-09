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
    return `Free: ${FREE_STORAGE_GB} GB local-first storage, ${FREE_RING_LIMIT} ring, Save Securely only.`;
  }
  if (entitlements.tier === "trial") {
    const d = Math.max(0, entitlements.trialDaysRemaining);
    return `Haven Plus trial: ${d} day${d === 1 ? "" : "s"} left. ${PLUS_STORAGE_GB} GB storage, up to ${PLUS_RING_LIMIT} rings, Seal with Ring.`;
  }
  return `Haven Plus: ${PLUS_STORAGE_GB} GB storage, up to ${PLUS_RING_LIMIT} rings, Seal with Ring, family sharing, AI insights, priority support.`;
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
    return `Free supports ${FREE_RING_LIMIT} ring. Haven Plus supports up to ${PLUS_RING_LIMIT} rings.`;
  }
  return `You have reached your plan's ring limit (Haven Plus: up to ${PLUS_RING_LIMIT} rings).`;
}
