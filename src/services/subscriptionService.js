import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import {
  FREE_RING_LIMIT,
  FREE_STORAGE_GB,
  PLUS_RING_LIMIT,
  PLUS_STORAGE_GB,
  defaultFreeEntitlements,
  userEntitlementsFromSubscriptionStatus,
} from "../features/subscription/subscriptionTypes";

export {
  FREE_STORAGE_GB,
  PLUS_STORAGE_GB,
  FREE_RING_LIMIT,
  PLUS_RING_LIMIT,
} from "../features/subscription/subscriptionTypes";

export {
  getSubscriptionLabel,
  getSubscriptionSummary,
  getPlanBadgeLabel,
  getRingSlotLimitUpsellNotice,
} from "../features/subscription/entitlementCopy";

const CACHE_KEY_V2 = "haven.entitlements.v2";
/** Legacy serialized `SubscriptionStatusLike` payloads */
const CACHE_KEY_V1 = "haven.subscription.status.v1";

function parseTime(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function getSubscriptionStatusFromEntitlement(row = null, nowMs = Date.now()) {
  const trialEndMs = parseTime(row?.plus_trial_end);
  const subscriptionEndMs = parseTime(row?.plus_subscription_end);
  const trialActive = trialEndMs > nowMs;
  const subscriptionActive =
    row?.plus_subscription_status === "active" &&
    (!subscriptionEndMs || subscriptionEndMs > nowMs);
  const isPlus = subscriptionActive || trialActive || row?.plan === "plus";
  const source = subscriptionActive ? "subscription" : trialActive ? "trial" : "free";
  const plusTrialDaysLeft = trialActive
    ? Math.max(1, Math.ceil((trialEndMs - nowMs) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    tier: isPlus ? "plus" : "free",
    source,
    plusTrialEnd: row?.plus_trial_end ?? null,
    plusTrialDaysLeft,
    ringLimit: isPlus ? PLUS_RING_LIMIT : FREE_RING_LIMIT,
    storageGb: isPlus ? PLUS_STORAGE_GB : FREE_STORAGE_GB,
    canSealWithRing: isPlus,
  };
}

export function getFreeEntitlements() {
  return defaultFreeEntitlements();
}

/** @deprecated use getFreeEntitlements */
export function getFreeSubscriptionStatus() {
  return getFreeEntitlements();
}

function normalizeSubscriptionPayload(sub) {
  if (!sub || typeof sub !== "object") return null;
  const tier = sub.tier === "plus" ? "plus" : sub.tier === "free" ? "free" : null;
  if (!tier) return null;
  const src = sub.source;
  const source =
    src === "subscription" ? "subscription" : src === "trial" ? "trial" : "free";
  return {
    tier,
    source,
    plusTrialEnd: typeof sub.plusTrialEnd === "string" ? sub.plusTrialEnd : null,
    plusTrialDaysLeft: Number(sub.plusTrialDaysLeft) || 0,
    ringLimit: Number(sub.ringLimit) || FREE_RING_LIMIT,
    storageGb: Number(sub.storageGb) || FREE_STORAGE_GB,
    canSealWithRing: Boolean(sub.canSealWithRing),
  };
}

function normalizeEntitlementsPayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tier = raw.tier;
  if (tier !== "free" && tier !== "plus" && tier !== "trial") return null;

  const maxRingsRaw =
    raw.maxRings ??
    raw.ringLimit ??
    (tier === "free" ? FREE_RING_LIMIT : PLUS_RING_LIMIT);
  const storageRaw =
    raw.cloudStorageGB ?? raw.storageGb ?? FREE_STORAGE_GB;

  const maxRings = Number(maxRingsRaw);
  const cloudStorageGB = Number(storageRaw);

  const plusLike = tier === "plus" || tier === "trial";

  return {
    tier,
    isTrial: Boolean(raw.isTrial ?? (tier === "trial")),
    trialDaysRemaining: Math.max(
      0,
      Number(raw.trialDaysRemaining ?? raw.plusTrialDaysLeft) || 0
    ),
    maxRings: Number.isFinite(maxRings) && maxRings > 0 ? maxRings : FREE_RING_LIMIT,
    cloudStorageGB:
      Number.isFinite(cloudStorageGB) && cloudStorageGB >= 0
        ? cloudStorageGB
        : FREE_STORAGE_GB,
    canSealWithRing: Boolean(raw.canSealWithRing ?? plusLike),
    canUseCloudBackup: Boolean(raw.canUseCloudBackup ?? plusLike),
    canFamilyShare: Boolean(raw.canFamilyShare ?? plusLike),
    canAiInsights: Boolean(raw.canAiInsights ?? plusLike),
  };
}

function coerceToEntitlements(payload) {
  if (!payload || typeof payload !== "object") return null;
  const direct = normalizeEntitlementsPayload(payload);
  if (direct) return direct;
  const legacy = normalizeSubscriptionPayload(payload);
  return legacy ? userEntitlementsFromSubscriptionStatus(legacy) : null;
}

export function cacheSubscriptionStatus(payload) {
  if (typeof window === "undefined") return;
  try {
    const ent = coerceToEntitlements(payload);
    if (!ent) return;
    const rest = { ...ent };
    delete rest.trialJustActivated;
    window.localStorage.setItem(CACHE_KEY_V2, JSON.stringify(rest));
  } catch (_) {
    /* ignore */
  }
}

export function readCachedSubscriptionStatus() {
  if (typeof window === "undefined") return defaultFreeEntitlements();
  try {
    const rawV2 = window.localStorage.getItem(CACHE_KEY_V2);
    if (rawV2) {
      const ent = coerceToEntitlements(JSON.parse(rawV2));
      if (ent) return ent;
    }
    const rawV1 = window.localStorage.getItem(CACHE_KEY_V1);
    if (rawV1) {
      const ent = coerceToEntitlements(JSON.parse(rawV1));
      if (ent) {
        cacheSubscriptionStatus(ent);
        try {
          window.localStorage.removeItem(CACHE_KEY_V1);
        } catch (_) {
          /* ignore */
        }
        return ent;
      }
    }
  } catch (_) {
    /* fall through */
  }
  return defaultFreeEntitlements();
}

async function fetchSubscriptionFromApi(accessToken) {
  const res = await fetch("/api/subscription/status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`subscription_api_${res.status}`);
  const body = await res.json();
  if (!body?.ok) {
    throw new Error("subscription_api_invalid_payload");
  }
  let ent = null;
  if (body.entitlements) {
    ent = normalizeEntitlementsPayload(body.entitlements);
  }
  if (!ent && body.subscription) {
    const legacy = normalizeSubscriptionPayload(body.subscription);
    if (legacy) ent = userEntitlementsFromSubscriptionStatus(legacy);
  }
  if (!ent) throw new Error("subscription_api_invalid_shape");
  return ent;
}

export async function loadSubscriptionStatus(session) {
  if (!session?.user?.id) {
    return defaultFreeEntitlements();
  }
  try {
    const token = session.access_token;
    if (token) {
      const viaApi = await fetchSubscriptionFromApi(token);
      cacheSubscriptionStatus(viaApi);
      return viaApi;
    }
  } catch {
    /* fall through */
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("plan, plus_trial_end, plus_subscription_status, plus_subscription_end")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  const snapshot = getSubscriptionStatusFromEntitlement(data);
  const ent = userEntitlementsFromSubscriptionStatus(snapshot);
  cacheSubscriptionStatus(ent);
  return ent;
}
