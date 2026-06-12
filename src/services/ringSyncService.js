import { classifySyncFailure } from "@/lib/sync-failure";
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
  upsertBoundRingByUidKey,
  updateRingCloudMetadata,
} from "./ringRegistryService";

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

function reconcileLocalRingsFromCloud(cloudRings = []) {
  let recovered = 0;
  for (const row of cloudRings) {
    const uidKey = String(row?.nfc_uid_hash || "");
    if (!uidKey || !row?.id) continue;
    const before = getBoundRings().find((ring) => ring.uidKey === uidKey);
    const ring = upsertBoundRingByUidKey(uidKey, {
      label: row.nickname || "Recovered ring",
      cloudRingId: row.id,
      havenId: row.haven_id || null,
      cloudBoundAt: row.bound_at || null,
      cloudLastUsedAt: row.last_used_at || null,
    });
    if (!before && ring) recovered += 1;
  }
  return recovered;
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

  const cloudMomentsResult = await fetchMomentsDelta(
    accessToken,
    localRings.map((r) => r.cloudRingId).filter(Boolean)
  );
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

  return {
    ok: true,
    mismatch,
    message: mismatch ? INTEGRITY_MISMATCH_MSG : "",
    cloudPlaceholders,
    activeUidKey: active?.uidKey || "",
    issues: Array.from(new Set(issues)).filter(isCriticalSyncIssue),
    recoveredLocalRings,
  };
}
