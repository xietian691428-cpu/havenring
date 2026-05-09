import { FREE_RING_LIMIT, type UserEntitlements, defaultFreeEntitlements } from "./subscriptionTypes";

export type FeatureGateOptions = {
  currentRingCount?: number;
};

/**
 * Unified feature gates for Free / Trial / Paid Plus (`UserEntitlements.tier`).
 * `feature` is normalized (case-insensitive, hyphens → underscores).
 */
export const canUseFeature = (
  entitlements: UserEntitlements | null | undefined,
  feature: string,
  opts?: FeatureGateOptions
): boolean => {
  const e = entitlements ?? defaultFreeEntitlements();
  const key = String(feature || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  switch (key) {
    case "seal_with_ring":
      return Boolean(e.canSealWithRing);

    case "cloud_backup":
    case "cloud_sync":
      return Boolean(e.canUseCloudBackup);

    case "family_sharing":
      return Boolean(e.canFamilyShare);

    case "ai_insights":
      return Boolean(e.canAiInsights);

    case "expand_ring_slots":
    case "add_ring_slot": {
      const limit =
        typeof e.maxRings === "number" && e.maxRings > 0
          ? e.maxRings
          : FREE_RING_LIMIT;
      const n = opts?.currentRingCount ?? 0;
      return n < limit;
    }
    default:
      return false;
  }
};
