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
    return `Free: ${FREE_STORAGE_GB} GB local-first storage, up to ${FREE_RING_LIMIT} rings for a private pair, Save Securely only.`;
  }
  if (entitlements.tier === "trial") {
    const d = Math.max(0, entitlements.trialDaysRemaining);
    return `Haven Plus trial: ${d} day${d === 1 ? "" : "s"} left. ${PLUS_STORAGE_GB} GB storage, up to ${PLUS_RING_LIMIT} rings for one private pair, Seal with Ring.`;
  }
  return `Haven Plus: ${PLUS_STORAGE_GB} GB storage, up to ${PLUS_RING_LIMIT} rings for one private pair, Seal with Ring, optional backup, priority support.`;
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
    return `Haven supports up to ${PLUS_RING_LIMIT} rings for one private pair, one per partner account. Invite your partner instead of sharing a login.`;
  }
  return `You have reached Haven's ring limit: up to ${PLUS_RING_LIMIT} rings for one private pair.`;
}
