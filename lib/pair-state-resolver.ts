/**
 * Client-side Pair + ring registry reconciliation.
 * Fetches cloud truth from GET /api/nfc/list, prunes stale local rows,
 * and updates havenId / cloud metadata on surviving local rings.
 */
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getBoundRings,
  pruneStaleLocalRingsFromCloud,
  updateRingCloudMetadata,
} from "@/src/services/ringRegistryService";

export type CloudRingRow = {
  id: string;
  user_id?: string;
  haven_id?: string | null;
  nfc_uid_hash?: string | null;
  nickname?: string | null;
  bound_at?: string | null;
  last_used_at?: string | null;
  ownedByYou?: boolean;
  pairPartnerRing?: boolean;
};

export type PairStateDrift =
  | "none"
  | "stale_local_rings"
  | "haven_id_mismatch"
  | "cloud_unreachable"
  | "unauthenticated";

export type PairRecommendedAction =
  | "none"
  | "retry_cloud_sync"
  | "enable_pair_sharing"
  | "await_pair_complete";

export type PairStateSnapshot = {
  ok: boolean;
  authenticated: boolean;
  pairActive: boolean;
  memberCount: number;
  primaryHavenId: string | null;
  cloudRings: CloudRingRow[];
  havens: Array<{ haven_id?: string; role?: string }>;
  localRingCount: number;
  prunedStaleCount: number;
  metadataReconciled: number;
  drift: PairStateDrift;
  recommendedAction: PairRecommendedAction;
  ownedCloudRingCount: number;
  error?: string;
};

export type ResolvePairStateOptions = {
  accessToken?: string;
  /** Bypass in-flight dedupe when a surface needs a fresh read. */
  force?: boolean;
};

let inflightResolve: Promise<PairStateSnapshot> | null = null;

function reconcileLocalMetadataFromCloud(cloudRows: CloudRingRow[]): number {
  let updated = 0;
  for (const ring of getBoundRings()) {
    if (!ring?.cloudRingId) continue;
    const match = cloudRows.find((row) => row.id === ring.cloudRingId);
    if (!match) continue;
    const nextHavenId = match.haven_id || null;
    const havenChanged = (ring.havenId || null) !== nextHavenId;
    const boundChanged =
      (ring.cloudBoundAt || null) !== (match.bound_at || null) ||
      (ring.cloudLastUsedAt || null) !== (match.last_used_at || null);
    if (!havenChanged && !boundChanged) continue;
    updateRingCloudMetadata(ring.uidKey, {
      cloudRingId: match.id,
      havenId: nextHavenId,
      cloudBoundAt: match.bound_at || null,
      cloudLastUsedAt: match.last_used_at || null,
    });
    updated += 1;
  }
  return updated;
}

function detectDrift(
  cloudRows: CloudRingRow[],
  prunedStaleCount: number,
  metadataReconciled: number
): PairStateDrift {
  if (prunedStaleCount > 0) return "stale_local_rings";
  if (metadataReconciled > 0) return "haven_id_mismatch";
  const local = getBoundRings();
  if (!cloudRows.length && local.some((ring: { cloudRingId?: string }) => ring.cloudRingId)) {
    return "cloud_unreachable";
  }
  return "none";
}

function pickRecommendedAction(
  pairActive: boolean,
  drift: PairStateDrift,
  ok: boolean
): PairRecommendedAction {
  if (!ok) return "retry_cloud_sync";
  if (pairActive) return "enable_pair_sharing";
  if (drift === "stale_local_rings" || drift === "haven_id_mismatch") {
    return "await_pair_complete";
  }
  return "none";
}

async function resolvePairStateInner(
  options: ResolvePairStateOptions
): Promise<PairStateSnapshot> {
  const localBefore = getBoundRings().length;

  if (typeof window === "undefined") {
    return {
      ok: false,
      authenticated: false,
      pairActive: false,
      memberCount: 0,
      primaryHavenId: null,
      cloudRings: [],
      havens: [],
      localRingCount: 0,
      prunedStaleCount: 0,
      metadataReconciled: 0,
      drift: "cloud_unreachable",
      recommendedAction: "retry_cloud_sync",
      ownedCloudRingCount: 0,
      error: "ssr",
    };
  }

  let accessToken = String(options.accessToken || "").trim();
  if (!accessToken) {
    const sb = getSupabaseBrowserClient();
    const { data } = await sb.auth.getSession();
    accessToken = data.session?.access_token || "";
  }

  if (!accessToken) {
    return {
      ok: false,
      authenticated: false,
      pairActive: false,
      memberCount: 0,
      primaryHavenId: null,
      cloudRings: [],
      havens: [],
      localRingCount: localBefore,
      prunedStaleCount: 0,
      metadataReconciled: 0,
      drift: "unauthenticated",
      recommendedAction: "retry_cloud_sync",
      ownedCloudRingCount: 0,
      error: "unauthenticated",
    };
  }

  try {
    const listRes = await fetch("/api/nfc/list", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await listRes.json().catch(() => ({}));
    if (!listRes.ok) {
      return {
        ok: false,
        authenticated: true,
        pairActive: false,
        memberCount: 0,
        primaryHavenId: null,
        cloudRings: [],
        havens: [],
        localRingCount: getBoundRings().length,
        prunedStaleCount: 0,
        metadataReconciled: 0,
        drift: "cloud_unreachable",
        recommendedAction: "retry_cloud_sync",
        ownedCloudRingCount: 0,
        error: String(payload?.error || "list_failed"),
      };
    }

    const cloudRows = (Array.isArray(payload.rings) ? payload.rings : []) as CloudRingRow[];
    const prunedStaleCount = pruneStaleLocalRingsFromCloud(cloudRows);
    const metadataReconciled = reconcileLocalMetadataFromCloud(cloudRows);
    const pairActive = Boolean(payload.pairActive);
    const drift = detectDrift(cloudRows, prunedStaleCount, metadataReconciled);
    const ownedCloudRingCount = cloudRows.filter((row) => row.ownedByYou).length;

    return {
      ok: true,
      authenticated: true,
      pairActive,
      memberCount: Number(payload.memberCount || 0),
      primaryHavenId:
        typeof payload.primaryHavenId === "string" ? payload.primaryHavenId : null,
      cloudRings: cloudRows,
      havens: Array.isArray(payload.havens) ? payload.havens : [],
      localRingCount: getBoundRings().length,
      prunedStaleCount,
      metadataReconciled,
      drift,
      recommendedAction: pickRecommendedAction(pairActive, drift, true),
      ownedCloudRingCount,
    };
  } catch (error) {
    return {
      ok: false,
      authenticated: true,
      pairActive: false,
      memberCount: 0,
      primaryHavenId: null,
      cloudRings: [],
      havens: [],
      localRingCount: getBoundRings().length,
      prunedStaleCount: 0,
      metadataReconciled: 0,
      drift: "cloud_unreachable",
      recommendedAction: "retry_cloud_sync",
      ownedCloudRingCount: 0,
      error: error instanceof Error ? error.message : "list_failed",
    };
  }
}

/** Unified cloud + local Pair / ring state reconciliation. */
export async function resolvePairState(
  options: ResolvePairStateOptions = {}
): Promise<PairStateSnapshot> {
  if (inflightResolve && !options.force) {
    return inflightResolve;
  }
  const runner = resolvePairStateInner(options);
  inflightResolve = runner;
  try {
    return await runner;
  } finally {
    if (inflightResolve === runner) {
      inflightResolve = null;
    }
  }
}
