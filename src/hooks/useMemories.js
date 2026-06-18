import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import {
  createMemory,
  deleteMemory,
  getMemoryById,
  getTimelineMemorySummaries,
  searchTimelineMemorySummaries,
  saveMemory,
} from "../services/localStorageService";
import { computeMemoryBundleHash } from "../utils/memoryIntegrity";
import {
  stageDraftForActiveRing,
  syncRingScopedCaches,
} from "../services/ringSyncService";
import { getActiveRingUidKey } from "../services/ringRegistryService";
import { classifySyncFailure } from "@/lib/sync-failure";
import { classifySyncHealth } from "../state/recoveryPolicy";
import { reconcilePairStateOnAppLifecycle } from "../state/appFlowSelectors";
import { flushOfflineSyncQueue } from "../services/offlineSyncQueue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { deferEntryWork, isLowMemoryEntryDevice } from "@/lib/entry-defer";
import {
  IOS_BOOT_REFRESH_DELAY_MS,
  shouldRunIosBackgroundSync,
} from "@/lib/ios-app-boot";
import { getTimelinePageSize } from "@/lib/timeline-ios-guard";
import { releaseAllTimelineThumbUrls } from "@/lib/timeline-thumb-cache";

const SAVE_RETRY_LIMIT = 2;
const SYNC_BACKOFF_BASE_MS = 5_000;
const SYNC_BACKOFF_MAX_MS = 5 * 60 * 1000;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextBackoffMs(failureStreak) {
  const exp = Math.max(0, failureStreak - 1);
  return Math.min(SYNC_BACKOFF_MAX_MS, SYNC_BACKOFF_BASE_MS * 2 ** exp);
}

export function useMemories() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [integrityWarning, setIntegrityWarning] = useState("");
  const [cloudPlaceholders, setCloudPlaceholders] = useState([]);
  const [syncIssues, setSyncIssues] = useState([]);
  const [syncMeta, setSyncMeta] = useState({
    lastAttemptAt: 0,
    lastSuccessAt: 0,
    lastFailureAt: 0,
    lastFailureCode: "",
    failureStreak: 0,
    nextRetryAt: 0,
    lastRecoveryAt: 0,
    lastRecoveryCount: 0,
  });
  const syncInFlightRef = useRef(null);
  const lastRefreshAtRef = useRef(0);
  const timelineCursorRef = useRef(null);
  const [timelineHasMore, setTimelineHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    releaseAllTimelineThumbUrls();
    try {
      const page = await getTimelineMemorySummaries({ limit: getTimelinePageSize() });
      timelineCursorRef.current = page.nextBeforeTimelineAt;
      setTimelineHasMore(page.hasMore);
      setMemories(page.items);
      lastRefreshAtRef.current = Date.now();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreMemories = useCallback(async () => {
    if (!timelineHasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getTimelineMemorySummaries({
        limit: getTimelinePageSize(),
        beforeTimelineAt: timelineCursorRef.current,
      });
      timelineCursorRef.current = page.nextBeforeTimelineAt;
      setTimelineHasMore(page.hasMore);
      setMemories((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        const next = page.items.filter((row) => !seen.has(row.id));
        return [...prev, ...next];
      });
    } catch {
      /* keep existing rows */
    } finally {
      setLoadingMore(false);
    }
  }, [timelineHasMore, loadingMore]);

  const searchMemories = useCallback(async (query) => {
    const q = String(query || "").trim();
    if (!q) {
      await refresh();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await searchTimelineMemorySummaries(q);
      setTimelineHasMore(false);
      timelineCursorRef.current = null;
      setMemories(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search memories.");
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const create = useCallback(
    async (payload) => {
      setSaving(true);
      setError(null);
      try {
        const now = Date.now();
        const nextId = payload?.id || crypto.randomUUID();
        const enrichedPayload = {
          ...payload,
          id: nextId,
          timelineAt: payload?.timelineAt || now,
          releaseAt: Number(payload?.releaseAt || 0) || 0,
        };
        const contentSha = await computeMemoryBundleHash({
          title: enrichedPayload.title,
          story: enrichedPayload.story,
          timelineAt: enrichedPayload.timelineAt,
          releaseAt: enrichedPayload.releaseAt,
          photos: Array.isArray(enrichedPayload.photo) ? enrichedPayload.photo : [],
        });
        await stageDraftForActiveRing({
          id: nextId,
          title: enrichedPayload.title || "",
          timelineAt: enrichedPayload.timelineAt,
          releaseAt: enrichedPayload.releaseAt,
          content_sha256: contentSha,
        });

        let result = null;
        let created = null;
        let lastError = null;

        for (let attempt = 0; attempt < SAVE_RETRY_LIMIT; attempt += 1) {
          try {
            result = await createMemory(enrichedPayload);
            created = await getMemoryById(result.id);
            if (!created) {
              throw new Error("Saved memory could not be verified.");
            }
            break;
          } catch (err) {
            lastError = err;
            if (attempt < SAVE_RETRY_LIMIT - 1) {
              await delay(150 * (attempt + 1));
            }
          }
        }

        if (!result || !created) {
          throw (lastError instanceof Error
            ? lastError
            : new Error("Failed to create memory."));
        }

        if (created) {
          setMemories((prev) =>
            [created, ...prev].sort((a, b) => b.timelineAt - a.timelineAt)
          );
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create memory.";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  /**
   * Write composer output to the encrypted timeline (create or replace by id).
   * Call after Draft Box persist so “Save securely” appears on the timeline.
   */
  const persistComposerMemory = useCallback(async (payload) => {
    setSaving(true);
    setError(null);
    try {
      const id = String(payload?.id || "").trim();
      if (!id) {
        throw new Error("Missing memory id.");
      }
      const now = Date.now();
      const enrichedPayload = {
        ...payload,
        id,
        title: String(payload?.title || "").trim() || "Untitled memory",
        story: String(payload?.story || ""),
        photo: Array.isArray(payload?.photo) && payload.photo.length ? payload.photo : null,
        attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
        timelineAt: Number(payload?.timelineAt || now) || now,
        releaseAt: Number(payload?.releaseAt || 0) || 0,
      };
      const contentSha = await computeMemoryBundleHash({
        title: enrichedPayload.title,
        story: enrichedPayload.story,
        timelineAt: enrichedPayload.timelineAt,
        releaseAt: enrichedPayload.releaseAt,
        photos: Array.isArray(enrichedPayload.photo) ? enrichedPayload.photo : [],
      });
      await stageDraftForActiveRing({
        id,
        title: enrichedPayload.title || "",
        timelineAt: enrichedPayload.timelineAt,
        releaseAt: enrichedPayload.releaseAt,
        content_sha256: contentSha,
      });

      const existing = await getMemoryById(id);
      if (existing) {
        await saveMemory({
          ...existing,
          title: enrichedPayload.title,
          story: enrichedPayload.story,
          photo: enrichedPayload.photo ?? existing.photo,
          attachments: enrichedPayload.attachments,
          releaseAt: enrichedPayload.releaseAt,
          timelineAt: enrichedPayload.timelineAt,
        });
      } else {
        await createMemory(enrichedPayload);
      }

      const created = await getMemoryById(id);
      if (created) {
        setMemories((prev) => {
          const filtered = prev.filter((item) => item.id !== id);
          return [created, ...filtered].sort((a, b) => b.timelineAt - a.timelineAt);
        });
      }
      return created;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save memory.";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }
    const runner = (async () => {
    const startedAt = Date.now();
    setSyncMeta((prev) => ({ ...prev, lastAttemptAt: startedAt, nextRetryAt: 0 }));
    setSyncing(true);
    try {
      try {
        const sb = getSupabaseBrowserClient();
        const { data: sessionData } = await sb.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (accessToken) {
          await flushOfflineSyncQueue(accessToken);
        }
      } catch {
        /* background flush */
      }

      const outcome = await syncRingScopedCaches();
      setIntegrityWarning("");
      setCloudPlaceholders(
        Array.isArray(outcome?.cloudPlaceholders) ? outcome.cloudPlaceholders : []
      );
      setSyncIssues(Array.isArray(outcome?.issues) ? outcome.issues : []);
      const issues = Array.isArray(outcome?.issues) ? outcome.issues : [];
      const refreshSkewMs = Date.now() - lastRefreshAtRef.current;
      if (!isLowMemoryEntryDevice() || refreshSkewMs > 2500) {
        await refresh();
      }
      if (outcome?.ok && !issues.length) {
        setSyncMeta((prev) => ({
          ...prev,
          lastSuccessAt: Date.now(),
          lastRecoveryAt: outcome?.recoveredLocalRings ? Date.now() : prev.lastRecoveryAt,
          lastRecoveryCount:
            typeof outcome?.recoveredLocalRings === "number"
              ? outcome.recoveredLocalRings
              : prev.lastRecoveryCount,
          lastFailureCode: "",
          failureStreak: 0,
          nextRetryAt: 0,
        }));
      } else if (issues.length) {
        setSyncMeta((prev) => {
          const streak = (prev.failureStreak || 0) + 1;
          const backoff = nextBackoffMs(streak);
          return {
            ...prev,
            lastFailureAt: Date.now(),
            lastFailureCode: issues[0],
            failureStreak: streak,
            nextRetryAt: Date.now() + backoff,
          };
        });
      }
        return outcome;
      } catch {
        const issue = classifySyncFailure({});
        setSyncIssues([issue]);
        setSyncMeta((prev) => {
          const streak = (prev.failureStreak || 0) + 1;
          const backoff = nextBackoffMs(streak);
          return {
            ...prev,
            lastFailureAt: Date.now(),
            lastFailureCode: issue,
            failureStreak: streak,
            nextRetryAt: Date.now() + backoff,
          };
        });
        throw new Error("sync_failed");
      } finally {
        setSyncing(false);
        syncInFlightRef.current = null;
      }
    })();
    syncInFlightRef.current = runner;
    return runner;
  }, [refresh]);

  const runSyncForActiveRing = useCallback(async () => {
    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }
    const targetUidKey = getActiveRingUidKey();
    if (!targetUidKey) {
      return runSync();
    }
    const runner = (async () => {
    const startedAt = Date.now();
    setSyncMeta((prev) => ({ ...prev, lastAttemptAt: startedAt, nextRetryAt: 0 }));
    setSyncing(true);
    try {
      try {
        const sb = getSupabaseBrowserClient();
        const { data: sessionData } = await sb.auth.getSession();
        const accessToken = sessionData.session?.access_token || "";
        if (accessToken) {
          await flushOfflineSyncQueue(accessToken);
        }
      } catch {
        /* background flush */
      }

      const outcome = await syncRingScopedCaches({ targetUidKey });
      setIntegrityWarning("");
      setCloudPlaceholders((prev) => {
        const keep = prev.filter((row) => row.uidKey !== targetUidKey);
        const next = Array.isArray(outcome?.cloudPlaceholders)
          ? outcome.cloudPlaceholders
          : [];
        return [...keep, ...next];
      });
      setSyncIssues(Array.isArray(outcome?.issues) ? outcome.issues : []);
      const issues = Array.isArray(outcome?.issues) ? outcome.issues : [];
      const refreshSkewMs = Date.now() - lastRefreshAtRef.current;
      if (!isLowMemoryEntryDevice() || refreshSkewMs > 2500) {
        await refresh();
      }
      if (outcome?.ok && !issues.length) {
        setSyncMeta((prev) => ({
          ...prev,
          lastSuccessAt: Date.now(),
          lastRecoveryAt: outcome?.recoveredLocalRings ? Date.now() : prev.lastRecoveryAt,
          lastRecoveryCount:
            typeof outcome?.recoveredLocalRings === "number"
              ? outcome.recoveredLocalRings
              : prev.lastRecoveryCount,
          lastFailureCode: "",
          failureStreak: 0,
          nextRetryAt: 0,
        }));
      } else if (issues.length) {
        setSyncMeta((prev) => {
          const streak = (prev.failureStreak || 0) + 1;
          const backoff = nextBackoffMs(streak);
          return {
            ...prev,
            lastFailureAt: Date.now(),
            lastFailureCode: issues[0],
            failureStreak: streak,
            nextRetryAt: Date.now() + backoff,
          };
        });
      }
        return outcome;
      } catch {
        const issue = classifySyncFailure({});
        setSyncIssues([issue]);
        setSyncMeta((prev) => {
          const streak = (prev.failureStreak || 0) + 1;
          const backoff = nextBackoffMs(streak);
          return {
            ...prev,
            lastFailureAt: Date.now(),
            lastFailureCode: issue,
            failureStreak: streak,
            nextRetryAt: Date.now() + backoff,
          };
        });
        throw new Error("sync_failed");
      } finally {
        setSyncing(false);
        syncInFlightRef.current = null;
      }
    })();
    syncInFlightRef.current = runner;
    return runner;
  }, [runSync, refresh]);

  const remove = useCallback(async (id) => {
    setError(null);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete memory.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  useEffect(() => {
    const run = () => {
      void refresh();
    };
    deferEntryWork(run, {
      timeout: isLowMemoryEntryDevice() ? IOS_BOOT_REFRESH_DELAY_MS : 500,
    });
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onStorage = (event) => {
      if (event.key === STORAGE_KEYS.sealCompleteRelay) {
        void refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    let unsubBroadcast = () => undefined;
    void import("../features/seal/sealBroadcast").then((mod) => {
      unsubBroadcast = mod.subscribeSealBroadcast((message) => {
        if (message.type === "seal_complete") {
          void refresh();
        }
      });
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      unsubBroadcast();
    };
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!shouldRunIosBackgroundSync("visibility")) return;
      void reconcilePairStateOnAppLifecycle().then(() => {
        void runSync();
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [runSync]);

  useEffect(() => {
    const runSoon = () => {
      if (!shouldRunIosBackgroundSync("mount-sync")) return;
      void reconcilePairStateOnAppLifecycle().finally(() => {
        void runSync();
      });
    };
    deferEntryWork(runSoon, {
      timeout: isLowMemoryEntryDevice() ? 16_000 : 1500,
    });
    const onOnline = () => {
      if (!shouldRunIosBackgroundSync("visibility")) return;
      void runSync();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runSync]);

  useEffect(() => {
    if (syncing) return undefined;
    if (!syncMeta?.nextRetryAt) return undefined;
    if (!shouldRunIosBackgroundSync("retry")) return undefined;
    const wait = syncMeta.nextRetryAt - Date.now();
    if (wait <= 0) {
      void runSync();
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void runSync();
    }, wait);
    return () => window.clearTimeout(timer);
  }, [syncMeta?.nextRetryAt, syncing, runSync]);

  return useMemo(
    () => ({
      memories,
      loading,
      saving,
      syncing,
      error,
      integrityWarning,
      cloudPlaceholders,
      syncIssues,
      syncMeta,
      syncHealth: classifySyncHealth({
        syncIssues,
        integrityWarning,
        syncMeta,
      }),
      refresh,
      loadMoreMemories,
      timelineHasMore,
      loadingMore,
      searchMemories,
      syncNow: runSync,
      syncActiveRingNow: runSyncForActiveRing,
      createMemory: create,
      persistComposerMemory,
      deleteMemory: remove,
    }),
    [
      memories,
      loading,
      saving,
      syncing,
      error,
      integrityWarning,
      cloudPlaceholders,
      syncIssues,
      syncMeta,
      refresh,
      loadMoreMemories,
      timelineHasMore,
      loadingMore,
      searchMemories,
      runSync,
      runSyncForActiveRing,
      create,
      persistComposerMemory,
      remove,
    ]
  );
}
