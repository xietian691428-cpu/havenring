import { classifySyncFailure } from "@/lib/sync-failure";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  backupToCloud,
  CLOUD_STORAGE_FULL_MESSAGE,
  isCloudBackupReady,
} from "./cloudBackupService";
import {
  clearRingSyncQueue,
  enqueueRingSync,
  putRingDraft,
  readCloudSnapshot,
  readRingSyncQueue,
  writeCloudSnapshot,
} from "./ringScopedCacheService";
import {
  getActiveRingOrFirst,
  getBoundRings,
  pruneStaleLocalRingsFromCloud,
  restoreLocalRingsFromCloud,
  updateRingCloudMetadata,
} from "./ringRegistryService";
import { syncPairMemoriesFromServer } from "./pairSharingService";

const INTEGRITY_MISMATCH_MSG = "detected_hash_mismatch";

export async function stageDraftForActiveRing(memoryDraft) {
  const ring = getActiveRingOrFirst();
  if (!ring?.uidKey || !memoryDraft?.id) {
    return { staged: false };
  }
  await putRingDraft(ring.uidKey, memoryDraft.id, memoryDraft);
  if (!isCloudBackupReady()) {
    return { staged: true, uidKey: ring.uidKey, queued: false };
  }
  await enqueueRingSync(ring.uidKey, {
    id: memoryDraft.id,
    title: memoryDraft.title,
    timelineAt: memoryDraft.timelineAt,
    releaseAt: Number(memoryDraft.releaseAt || 0) || 0,
    content_sha256: memoryDraft.content_sha256,
  });
  return { staged: true, uidKey: ring.uidKey };
}

async function fetchCloudRingBindings(accessToken) {
  try {
    const res = await fetch("/api/nfc/list", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: classifySyncFailure({ httpStatus: res.status }),
        rows: [],
      };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true,
      reason: "",
      rows: Array.isArray(payload.rings) ? payload.rings : [],
    };
  } catch (error) {
    return { ok: false, reason: classifySyncFailure({ error }), rows: [] };
  }
}

function buildCloudRingMapById(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row?.id) {
      map.set(row.id, row);
    }
  }
  return map;
}

/**
 * @deprecated Use restoreLocalRingsFromCloud from ringRegistryService.
 */
function reconcileLocalRingsFromCloud(cloudRings = []) {
  return restoreLocalRingsFromCloud(cloudRings).recovered;
}

/**
 * Lightweight ring registry restore after cache clear — no moment/pair import.
 * @param {string} [accessToken] — prefer session from context to avoid getSession races.
 */
export async function hydrateRingRegistryFromCloud(accessToken) {
  let token = String(accessToken || "").trim();
  if (!token) {
    const sb = getSupabaseBrowserClient();
    const { data } = await sb.auth.getSession();
    token = data.session?.access_token || "";
  }
  if (!token) {
    return {
      ok: false,
      recovered: 0,
      ringCount: getBoundRings().length,
      ownedOnServer: 0,
      reason: "auth",
    };
  }
  const cloudRingResult = await fetchCloudRingBindings(token);
  if (!cloudRingResult.ok) {
    return {
      ok: false,
      recovered: 0,
      ringCount: getBoundRings().length,
      ownedOnServer: 0,
      reason: cloudRingResult.reason || "fetch_failed",
    };
  }
  const cloudRings = cloudRingResult.rows || [];
  pruneStaleLocalRingsFromCloud(cloudRings);
  const { recovered, ringCount, skipped, ownedOnServer } =
    restoreLocalRingsFromCloud(cloudRings);
  return {
    ok: true,
    recovered,
    ringCount,
    skipped,
    ownedOnServer,
  };
}

async function fetchMomentsDelta(accessToken, cloudRingIds) {
  if (!Array.isArray(cloudRingIds) || !cloudRingIds.length) {
    return { ok: true, reason: "", rows: [] };
  }
  try {
    const params = new URLSearchParams({
      ring_ids: cloudRingIds.join(","),
    });
    const res = await fetch(`/api/sync/moments?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: classifySyncFailure({ httpStatus: res.status }),
        rows: [],
      };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true,
      reason: "",
      rows: Array.isArray(payload.moments) ? payload.moments : [],
    };
  } catch (error) {
    return { ok: false, reason: classifySyncFailure({ error }), rows: [] };
  }
}

function isCriticalSyncIssue(issue) {
  return issue === "auth" || issue === "hash";
}

/** iOS background sync skips pair bundle import unless explicitly requested (pull refresh). */
function shouldImportPairMemories(options = {}) {
  if (options.includePairSync === true) return true;
  if (options.includePairSync === false) return false;
  return !isIosWebKit();
}

export async function syncRingScopedCaches(options = {}) {
  const targetUidKey = String(options?.targetUidKey || "");
  const sb = getSupabaseBrowserClient();
  const { data } = await sb.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return {
      ok: false,
      reason: "auth",
      mismatch: false,
      cloudPlaceholders: [],
      issues: ["auth"],
    };
  }

  const issues = [];
  const cloudRingResult = await fetchCloudRingBindings(accessToken);
  if (!cloudRingResult.ok && cloudRingResult.reason === "auth") {
    issues.push("auth");
  } else if (!cloudRingResult.ok && cloudRingResult.reason) {
    console.warn("[haven-ring] ring list sync skipped:", cloudRingResult.reason);
  }
  const cloudRings = cloudRingResult.rows || [];
  if (cloudRingResult.ok) {
    pruneStaleLocalRingsFromCloud(cloudRings);
  }
  const recoveredLocalRings = reconcileLocalRingsFromCloud(cloudRings);
  const localRingsAll = getBoundRings();
  const active = getActiveRingOrFirst();
  const localRings = targetUidKey
    ? localRingsAll.filter((ring) => ring.uidKey === targetUidKey)
    : localRingsAll;
  const cloudById = buildCloudRingMapById(cloudRings);

  for (const localRing of localRings) {
    if (!localRing?.cloudRingId) continue;
    const cloud = cloudById.get(localRing.cloudRingId);
    if (!cloud) continue;
    updateRingCloudMetadata(localRing.uidKey, {
      cloudRingId: cloud.id,
      havenId: cloud.haven_id || null,
      cloudBoundAt: cloud.bound_at || null,
      cloudLastUsedAt: cloud.last_used_at || null,
    });
  }

  const allCloudRingIds = cloudRings.map((r) => r.id).filter(Boolean);
  const cloudMomentsResult = await fetchMomentsDelta(accessToken, allCloudRingIds);
  if (!cloudMomentsResult.ok && cloudMomentsResult.reason) {
    console.warn("[haven-ring] moments metadata sync skipped:", cloudMomentsResult.reason);
  }
  const cloudMoments = cloudMomentsResult.rows || [];
  const byMomentId = new Map(cloudMoments.map((row) => [row.id, row]));
  const cloudMomentsByRing = new Map();
  for (const row of cloudMoments) {
    if (!cloudMomentsByRing.has(row.ring_id)) {
      cloudMomentsByRing.set(row.ring_id, []);
    }
    cloudMomentsByRing.get(row.ring_id).push(row);
  }

  let mismatch = false;
  const cloudPlaceholders = [];

  for (const ring of localRings) {
    try {
      const queue = await readRingSyncQueue(ring.uidKey);
      const syncedIds = [];

      const cloudBackupReady = isCloudBackupReady();

      if (!cloudBackupReady) {
        if (queue.length) {
          await clearRingSyncQueue(
            ring.uidKey,
            queue.map((row) => row?.id).filter(Boolean)
          );
        }
      } else {
        for (const item of queue) {
          const cloud = byMomentId.get(item.id);
          if (cloud?.content_sha256 && item?.content_sha256) {
            if (cloud.content_sha256 !== item.content_sha256) {
              // Server seal digest is full JSON; local queue uses photosCount — drop stale row.
              syncedIds.push(item.id);
              continue;
            }
            syncedIds.push(item.id);
            continue;
          }
          try {
            await backupToCloud({
              ring_uid_hash: ring.uidKey,
              id: item.id,
              title: item.title || "",
              timelineAt: item.timelineAt || Date.now(),
              releaseAt: Number(item.releaseAt || 0) || 0,
              content_sha256: item.content_sha256 || null,
            });
            syncedIds.push(item.id);
          } catch (error) {
            const msg = error instanceof Error ? error.message : "";
            if (msg === CLOUD_STORAGE_FULL_MESSAGE) {
              console.warn("[haven-ring] cloud backup quota full; queue retained");
              break;
            }
            console.warn("[haven-ring] optional cloud backup skipped:", error);
          }
        }
      }

      if (syncedIds.length) {
        await clearRingSyncQueue(ring.uidKey, syncedIds);
      }

      const ringCloudRows = cloudMomentsByRing.get(ring.cloudRingId) || [];
      const previous = await readCloudSnapshot(ring.uidKey);
      if (ringCloudRows.length || previous.length) {
        await writeCloudSnapshot(ring.uidKey, ringCloudRows);
      }

      for (const row of ringCloudRows) {
        cloudPlaceholders.push({
          id: row.id,
          ring_id: row.ring_id,
          uidKey: ring.uidKey,
          timelineAt: Date.parse(row.created_at || "") || Date.now(),
          releaseAt: Date.parse(row.release_at || "") || 0,
          content_sha256: row.content_sha256 || null,
          ringLabel: ring.label || "Ring",
        });
      }
    } catch (error) {
      console.warn("[haven-ring] ring-scoped cache sync skipped:", ring?.uidKey, error);
    }
  }

  let pairImported = 0;
  let pairActive = false;
  let pairBundlesSeen = 0;
  if (shouldImportPairMemories(options)) {
    try {
      const pairOutcome = await syncPairMemoriesFromServer(accessToken, {
        fullPairSync: Boolean(options.fullPairSync),
      });
      pairImported = Number(pairOutcome?.imported || 0);
      pairActive = Boolean(pairOutcome?.pairActive);
      pairBundlesSeen = Number(pairOutcome?.bundlesSeen ?? pairOutcome?.total ?? 0);
    } catch (error) {
      console.warn("[haven-ring] pair memory import skipped:", error);
      try {
        const { enqueuePairSyncRetry } = await import("./offlineSyncQueue");
        await enqueuePairSyncRetry();
      } catch {
        /* ignore */
      }
    }
  }

  return {
    ok: true,
    mismatch,
    message: mismatch ? INTEGRITY_MISMATCH_MSG : "",
    cloudPlaceholders,
    activeUidKey: active?.uidKey || "",
    issues: Array.from(new Set(issues)).filter(isCriticalSyncIssue),
    recoveredLocalRings,
    pairImported,
    pairActive,
    pairBundlesSeen,
  };
}
