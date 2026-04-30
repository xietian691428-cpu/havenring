import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { backupToCloud } from "./cloudBackupService";
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
      return { ok: false, reason: res.status === 401 ? "auth" : "network", rows: [] };
    }
    const payload = await res.json().catch(() => ({}));
    return {
      ok: true,
      reason: "",
      rows: Array.isArray(payload.rings) ? payload.rings : [],
    };
  } catch {
    return { ok: false, reason: "network", rows: [] };
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
      cloudBoundAt: row.bound_at || null,
      cloudLastUsedAt: row.last_used_at || null,
    });
    if (!before && ring) recovered += 1;
  }
  return recovered;
}

async function fetchMomentsDelta(cloudRingIds) {
  if (!Array.isArray(cloudRingIds) || !cloudRingIds.length) return [];
  const sb = getSupabaseBrowserClient();
  const { data, error } = await sb
    .from("moments")
    .select("id, ring_id, created_at, release_at, content_sha256, is_sealed")
    .in("ring_id", cloudRingIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, reason: "network", rows: [] };
  return { ok: true, reason: "", rows: data || [] };
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
  if (!cloudRingResult.ok && cloudRingResult.reason) {
    issues.push(cloudRingResult.reason);
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
      cloudBoundAt: cloud.bound_at || null,
      cloudLastUsedAt: cloud.last_used_at || null,
    });
  }

  const cloudMomentsResult = await fetchMomentsDelta(
    localRings.map((r) => r.cloudRingId).filter(Boolean)
  );
  if (!cloudMomentsResult.ok && cloudMomentsResult.reason) {
    issues.push(cloudMomentsResult.reason);
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
    const queue = await readRingSyncQueue(ring.uidKey);
    const syncedIds = [];

    for (const item of queue) {
      const cloud = byMomentId.get(item.id);
      if (cloud?.content_sha256 && item?.content_sha256) {
        if (cloud.content_sha256 !== item.content_sha256) {
          mismatch = true;
          issues.push("hash");
          continue;
        }
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
      } catch {
        // Cloud backup is optional; keep queue for next login/online sync.
        issues.push("network");
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
  }

  return {
    ok: true,
    mismatch,
    message: mismatch ? INTEGRITY_MISMATCH_MSG : "",
    cloudPlaceholders,
    activeUidKey: active?.uidKey || "",
    issues: Array.from(new Set(issues)),
    recoveredLocalRings,
  };
}
