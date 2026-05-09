/**
 * Canonical subscription / entitlements imports for UI and shells.
 */

export type {
  SubscriptionTier,
  UserEntitlements,
  SubscriptionStatusLike,
} from "./subscriptionTypes";
export {
  FREE_STORAGE_GB,
  PLUS_STORAGE_GB,
  FREE_RING_LIMIT,
  PLUS_RING_LIMIT,
  defaultFreeEntitlements,
  userEntitlementsFromSubscriptionStatus,
} from "./subscriptionTypes";
export { canUseFeature, type FeatureGateOptions } from "./canUseFeature";
export {
  getSubscriptionLabel,
  getSubscriptionSummary,
  getPlanBadgeLabel,
  getRingSlotLimitUpsellNotice,
} from "./entitlementCopy";
