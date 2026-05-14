import { canUseFeature } from "../subscription/canUseFeature";
import type { UserEntitlements } from "../subscription/subscriptionTypes";

export const FEATURE_SEAL_WITH_RING = "seal_with_ring" as const;

export function canSealWithRing(
  entitlements: UserEntitlements | null | undefined
): boolean {
  return canUseFeature(entitlements, FEATURE_SEAL_WITH_RING);
}

export type SealWithRingGateResult =
  | { ok: true }
  | { ok: false; code: "upgrade_required" };

export function gateSealWithRingAccess(
  entitlements: UserEntitlements | null | undefined
): SealWithRingGateResult {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_HAVEN_SEAL_RING_DEV === "1"
  ) {
    return { ok: true };
  }
  return canSealWithRing(entitlements)
    ? { ok: true }
    : { ok: false, code: "upgrade_required" };
}
