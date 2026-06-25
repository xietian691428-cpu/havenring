import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  isFirstMemoryCompleted,
  ONBOARDING_DONE_KEY,
  TIMELINE_TRY_SEAL_HINT_DISMISSED_KEY,
} from "../services/firstRunTelemetryService";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { listDraftItems } from "../services/draftBoxService";
import { TIMELINE_PAGE_CONTENT } from "../content/timelinePageContent";
import { sanctuaryTheme } from "../theme/sanctuaryTheme";
import { APP_PAGE_PADDING } from "../theme/pageLayout";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useTimelineMemoryMode } from "../hooks/useTimelineMemoryMode";
import { useTimelineThumbUrls } from "../hooks/useTimelineThumbUrls";
import { TimelineMemoryCard } from "../components/TimelineMemoryCard";
import { TimelinePullRefreshBar } from "../components/TimelinePullRefreshBar";
import { getTimelineVirtualOverscan, getTimelinePageSize, shouldUseTimelineVirtualList } from "@/lib/timeline-ios-guard";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { isIosAppBootQuiet } from "@/lib/ios-app-boot";

/**
 * Timeline — primary “memory space” view; photo-forward cards on warm canvas.
 */
export function TimelinePage({
  memories = [],
  loading = false,
  error = "",
  syncing = false,
  syncMeta = null,
  syncIssues = [],
  integrityWarning = "",
  onResyncNow,
  onPullRefresh,
  onLoadMore,
  hasMoreMemories = false,
  loadingMore = false,
  onSearchMemories,
  onOpenMemory,
  onOpenMemoryFromRing,
  onCreateMemory,
  onImportDraft,
  flowPrimaryUi = null,
  onFlowPrimaryAction,
  locale = "en",
}) {
  const t = TIMELINE_PAGE_CONTENT[locale] || TIMELINE_PAGE_CONTENT.en;
  const { textFirst: memoryTextFirst, thumbsAllowed } = useTimelineMemoryMode();
  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const sync = () => setNetworkOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  const [pinnedId, setPinnedId] = useState(null);
  const [notice, setNotice] = useState("");
  const ringHandledRef = useRef(false);
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();

  const [hintHidden, setHintHidden] = useState(false);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    let active = true;
    void listDraftItems().then((items) => {
      if (active) setDraftCount(Array.isArray(items) ? items.length : 0);
    });
    return () => {
      active = false;
    };
  }, [loading, memories.length]);

  const showPostFtuxBanner = useMemo(() => {
    if (hintHidden) return false;
    if (typeof window === "undefined" || loading) return false;
    if (memories.length > 0) return false;
    try {
      return (
        window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1" &&
        !isFirstMemoryCompleted() &&
        window.localStorage.getItem(TIMELINE_TRY_SEAL_HINT_DISMISSED_KEY) !== "1"
      );
    } catch {
      return false;
    }
  }, [loading, memories.length, hintHidden]);

  function dismissPostFtuxBanner() {
    try {
      window.localStorage.setItem(TIMELINE_TRY_SEAL_HINT_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    setHintHidden(true);
  }

  const [viewerNow, setViewerNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setViewerNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const ordered = useMemo(() => {
    const list = [...memories].sort((a, b) => b.timelineAt - a.timelineAt);
    if (!pinnedId) return list;
    return list.sort((a, b) => (a.id === pinnedId ? -1 : b.id === pinnedId ? 1 : 0));
  }, [memories, pinnedId]);

  function togglePin(id) {
    setPinnedId((prev) => {
      const next = prev === id ? null : id;
      setNotice(next ? t.pinnedNotice : t.unpinnedNotice);
      triggerSuccessFeedback({
        soundEnabled,
        hapticEnabled,
        allowSound: soundScope === "all_success",
      });
      return next;
    });
  }

  useEffect(() => {
    if (ringHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId =
      params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    ringHandledRef.current = true;
    (onOpenMemoryFromRing ?? onOpenMemory)?.(memoryId);
  }, [onOpenMemoryFromRing, onOpenMemory]);

  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounceRef = useRef(null);
  const hadSearchRef = useRef(false);

  useEffect(() => {
    if (typeof onSearchMemories !== "function") return undefined;
    const q = searchQuery.trim();
    if (q) hadSearchRef.current = true;
    if (!q && !hadSearchRef.current) return undefined;
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = window.setTimeout(() => {
      void onSearchMemories(searchQuery);
    }, 320);
    return () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, onSearchMemories]);

  const orderedFiltered = useMemo(() => ordered, [ordered]);
  const listAnchorRef = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const useVirtualList =
    shouldUseTimelineVirtualList(orderedFiltered.length) && !searchQuery.trim();

  useLayoutEffect(() => {
    if (!useVirtualList || typeof window === "undefined") return undefined;
    const root = document.querySelector(".haven-app-main-scroll");
    const anchor = listAnchorRef.current;
    if (!root || !anchor) return undefined;
    const measure = () => {
      setScrollMargin(root.scrollTop + anchor.offsetTop);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(anchor);
    root.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", measure);
    };
  }, [useVirtualList, orderedFiltered.length, loading, memoryTextFirst, syncing]);

  const virtualizer = useVirtualizer({
    count: useVirtualList ? orderedFiltered.length : 0,
    getScrollElement: () => document.querySelector(".haven-app-main-scroll"),
    estimateSize: () => 400,
    overscan: getTimelineVirtualOverscan(),
    scrollMargin,
    enabled: useVirtualList,
  });
  const virtualItems = virtualizer.getVirtualItems();
  const virtualListBroken =
    useVirtualList && orderedFiltered.length > 0 && virtualItems.length === 0;
  const renderVirtualList = useVirtualList && !virtualListBroken;

  const [pullSyncActive, setPullSyncActive] = useState(false);

  const handlePullRefresh = useCallback(async () => {
    setPullSyncActive(true);
    try {
      if (typeof onPullRefresh === "function") {
        await onPullRefresh();
        return;
      }
      if (typeof onResyncNow === "function") {
        await onResyncNow();
      }
    } finally {
      setPullSyncActive(false);
    }
  }, [onPullRefresh, onResyncNow]);

  const {
    active: pullActive,
    progress: pullProgress,
    refreshing: pullRefreshing,
    pullDistance,
  } = usePullToRefresh({
    onRefresh: handlePullRefresh,
    disabled: loading,
  });

  useEffect(() => {
    if (!syncing && !pullRefreshing) {
      setPullSyncActive(false);
    }
  }, [syncing, pullRefreshing]);

  const visibleMemories = orderedFiltered;
  const [intersectingIds, setIntersectingIds] = useState(() => new Set());
  const [intersectionReady, setIntersectionReady] = useState(false);

  useEffect(() => {
    if (renderVirtualList || typeof window === "undefined") return undefined;
    const root = document.querySelector(".haven-app-main-scroll");
    if (!root) return undefined;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) return;
        setIntersectionReady(true);
        setIntersectingIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const id = entry.target.getAttribute("data-memory-id");
            if (!id) continue;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      { root, rootMargin: "120px 0px", threshold: 0.01 }
    );

    const observeNodes = () => {
      const nodes = root.querySelectorAll("[data-memory-id]");
      nodes.forEach((node) => observer.observe(node));
    };

    observeNodes();
    const raf = window.requestAnimationFrame(() => {
      observeNodes();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [renderVirtualList, orderedFiltered.length, loading, memoryTextFirst]);

  const thumbMemories = useMemo(() => {
    if (!renderVirtualList) {
      if (!isIosWebKit()) return visibleMemories;
      if (intersectingIds.size > 0) {
        return visibleMemories.filter((row) => intersectingIds.has(row.id));
      }
      if (!intersectionReady && visibleMemories.length > 0) {
        return visibleMemories.slice(0, getTimelinePageSize());
      }
      return visibleMemories.slice(0, getTimelinePageSize());
    }
    return virtualItems.map((row) => orderedFiltered[row.index]).filter(Boolean);
  }, [
    renderVirtualList,
    virtualItems,
    orderedFiltered,
    visibleMemories,
    intersectingIds,
    intersectionReady,
  ]);
  const visibleThumbKey = useMemo(
    () =>
      thumbMemories
        .map((row) =>
          [
            row?.id,
            row?.hasPhotos === false ? 0 : 1,
            row?.hasLargePhotos ? 1 : 0,
            Number(row?.updatedAt || 0),
          ].join(":")
        )
        .join("|"),
    [thumbMemories]
  );
  const thumbPaused =
    loading ||
    syncing ||
    pullSyncActive ||
    pullRefreshing ||
    !thumbsAllowed;
  const thumbById = useTimelineThumbUrls(visibleThumbKey, thumbPaused, memoryTextFirst);

  useEffect(() => {
    if (!renderVirtualList || !hasMoreMemories || loadingMore || searchQuery.trim()) return undefined;
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= orderedFiltered.length - 2) {
      void onLoadMore?.();
    }
    return undefined;
  }, [
    renderVirtualList,
    virtualItems,
    hasMoreMemories,
    loadingMore,
    orderedFiltered.length,
    onLoadMore,
    searchQuery,
  ]);

  const showHeroWhenEmpty =
    !loading && !searchQuery && !ordered.length && !showPostFtuxBanner;

  const showPullBar = pullActive || pullRefreshing || pullSyncActive;
  const pullLabel = pullRefreshing || pullSyncActive
    ? t.pullToRefreshSyncing
    : pullProgress >= 1
      ? t.pullToRefreshRelease
      : t.pullToRefresh;

  return (
    <main style={styles.page}>
      <TimelinePullRefreshBar
        visible={showPullBar}
        label={pullLabel}
        progress={pullProgress}
        pullDistance={pullDistance}
        refreshing={pullRefreshing || pullSyncActive}
      />
      <section style={styles.shell}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>{t.title}</h1>
            {ordered.length ? <p style={styles.tagline}>{t.tagline}</p> : null}
            <label style={styles.searchWrap}>
              <span style={styles.srOnly}>{t.searchPlaceholder}</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                style={styles.searchInput}
                autoComplete="off"
              />
            </label>
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={onCreateMemory} style={styles.createButton}>
              {t.fabSealNew || t.create}
            </button>
          </div>
        </header>

        {showHeroWhenEmpty ? (
          <section style={styles.heroPanel}>
            <p style={styles.heroLine}>{t.heroMemoriesLine}</p>
            <button type="button" onClick={() => onCreateMemory?.()} style={styles.heroCta}>
              {t.heroSealCta}
            </button>
          </section>
        ) : null}

        {flowPrimaryUi ? (
          <section style={styles.flowCard} role="status" aria-live="polite">
            <p style={styles.flowTitle}>{flowPrimaryUi.title}</p>
            <p style={styles.flowBody}>{flowPrimaryUi.body}</p>
            {flowPrimaryUi.actionLabel ? (
              <button
                type="button"
                onClick={() => onFlowPrimaryAction?.("primary")}
                style={styles.flowCta}
              >
                {flowPrimaryUi.actionLabel}
              </button>
            ) : null}
          </section>
        ) : null}

        {integrityWarning ? (
          <section style={styles.syncBanner} role="status" aria-live="polite">
            <p style={styles.syncBannerText}>{t.syncingBackground}</p>
          </section>
        ) : null}

        {showPostFtuxBanner ? (
          <section style={styles.ftuxBanner} aria-label={t.postOnboardingWelcome}>
            <div style={styles.ftuxTextCol}>
              <p style={styles.ftuxWelcome}>{t.postOnboardingWelcome}</p>
              <p style={styles.ftuxTeaser}>{t.postOnboardingSealTeaser}</p>
            </div>
            <div style={styles.ftuxActions}>
              <button type="button" onClick={() => onCreateMemory?.()} style={styles.ftuxPrimary}>
                {t.postOnboardingCta}
              </button>
              <button type="button" onClick={() => dismissPostFtuxBanner()} style={styles.ftuxDismiss}>
                {t.postOnboardingDismiss}
              </button>
            </div>
          </section>
        ) : null}

        {memoryTextFirst ? (
          <section style={styles.memoryGuardBanner} role="status" aria-live="polite">
            <p style={styles.syncBannerText}>{t.memoryGuardTextFirst}</p>
          </section>
        ) : null}

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {syncing && !showPullBar && !isIosAppBootQuiet() ? (
          <section style={styles.syncBanner} role="status" aria-live="polite">
            <p style={styles.syncBannerText}>{t.syncStatusRunning}</p>
          </section>
        ) : null}
        {!syncing && syncIssues?.length ? (
          <section style={styles.syncBanner} role="status" aria-live="polite">
            <p style={styles.syncBannerText}>
              {!networkOnline || syncIssues.includes("offline")
                ? t.syncIssueOffline
                : syncIssues.includes("auth")
                  ? t.syncIssueAuth
                  : t.syncingBackground}
            </p>
          </section>
        ) : null}
        {error ? (
          <p style={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !orderedFiltered.length && !showHeroWhenEmpty ? (
          <section style={styles.emptyPanel}>
            <div style={styles.emptyArt} aria-hidden>
              ◎
            </div>
            <p style={styles.emptyTitle}>
              {searchQuery.trim() ? t.emptySearch : t.emptySealedTitle}
            </p>
            <p style={styles.emptyBody}>
              {searchQuery.trim() ? t.emptySearchHint : t.emptySealedBody}
            </p>
            {!searchQuery.trim() ? (
              <div style={styles.emptyActions}>
                <button type="button" onClick={() => onCreateMemory?.()} style={styles.primaryButton}>
                  {t.emptyPrimaryCta}
                </button>
                {draftCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => (onImportDraft ?? onCreateMemory)?.()}
                    style={styles.secondaryGhost}
                  >
                    {t.emptySecondaryCta}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div ref={listAnchorRef}>
          {orderedFiltered.length ? (
            renderVirtualList ? (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                <ol style={styles.virtualList}>
                  {virtualItems.map((virtualRow) => {
                    const memory = orderedFiltered[virtualRow.index];
                    if (!memory) return null;
                    const pinned = pinnedId === memory.id;
                    const locked = Number(memory?.releaseAt || 0) > viewerNow;
                    return (
                      <li
                        key={memory.id}
                        data-index={virtualRow.index}
                        data-memory-id={memory.id}
                        ref={virtualizer.measureElement}
                        style={{
                          ...styles.virtualItem,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TimelineMemoryCard
                          memory={memory}
                          thumbUrl={memoryTextFirst ? "" : thumbById[memory.id] || ""}
                          textFirst={memoryTextFirst}
                          deferLargeThumb={memory.hasLargePhotos}
                          pinned={pinned}
                          locked={locked}
                          viewerNow={viewerNow}
                          t={t}
                          onTogglePin={togglePin}
                          onOpen={onOpenMemory}
                        />
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <ol style={styles.list}>
                {orderedFiltered.map((memory) => {
                  const pinned = pinnedId === memory.id;
                  const locked = Number(memory?.releaseAt || 0) > viewerNow;
                  return (
                    <li key={memory.id} data-memory-id={memory.id} style={styles.listItem}>
                      <TimelineMemoryCard
                        memory={memory}
                        thumbUrl={memoryTextFirst ? "" : thumbById[memory.id] || ""}
                        textFirst={memoryTextFirst}
                        deferLargeThumb={memory.hasLargePhotos}
                        pinned={pinned}
                        locked={locked}
                        viewerNow={viewerNow}
                        t={t}
                        onTogglePin={togglePin}
                        onOpen={onOpenMemory}
                      />
                    </li>
                  );
                })}
              </ol>
            )
          ) : null}
        </div>

        {loadingMore ? (
          <p style={styles.feedback} role="status">
            {t.loadingMore}
          </p>
        ) : null}

        <p style={styles.feedback} role="status" aria-live="polite">
          {notice || "\u00a0"}
        </p>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "min-content",
    padding: APP_PAGE_PADDING,
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 560,
    margin: "0 auto",
    display: "grid",
    gap: 10,
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
    display: "grid",
    gap: 8,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
  searchWrap: {
    display: "block",
    maxWidth: 420,
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid rgba(232, 220, 208, 0.14)",
    background: "rgba(18, 14, 12, 0.55)",
    color: sanctuaryTheme.cream,
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
  },
  heroPanel: {
    border: "1px solid rgba(196, 149, 106, 0.28)",
    borderRadius: 16,
    padding: 16,
    background: "rgba(36, 28, 48, 0.22)",
    display: "grid",
    gap: 10,
    alignItems: "start",
  },
  heroLine: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: "rgba(240, 228, 255, 0.92)",
    lineHeight: 1.4,
  },
  heroCta: {
    justifySelf: "start",
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  emptyPanel: {
    textAlign: "center",
    padding: "20px 16px",
    borderRadius: 18,
    border: "1px dashed rgba(196, 149, 106, 0.35)",
    background: "rgba(26, 21, 18, 0.35)",
    display: "grid",
    gap: 10,
    justifyItems: "center",
  },
  emptyArt: {
    fontSize: 36,
    opacity: 0.45,
    color: sanctuaryTheme.accentSoft,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 650,
    color: sanctuaryTheme.cream,
  },
  emptyBody: {
    margin: 0,
    maxWidth: 400,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.72)",
  },
  emptyActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    marginTop: 4,
  },
  secondaryGhost: {
    border: "1px solid rgba(232, 220, 208, 0.2)",
    background: "transparent",
    color: "rgba(248, 239, 231, 0.85)",
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 600,
    color: sanctuaryTheme.cream,
    lineHeight: 1.2,
  },
  createButton: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  tagline: {
    margin: "4px 0 0",
    fontSize: 13,
    lineHeight: 1.4,
    color: "rgba(248, 239, 231, 0.65)",
    maxWidth: 420,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 10,
  },
  listItem: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  ftuxBanner: {
    border: "1px solid rgba(196, 149, 106, 0.35)",
    borderRadius: 16,
    background: "rgba(44, 36, 31, 0.55)",
    padding: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  ftuxTextCol: {
    flex: "1 1 220px",
    minWidth: 0,
    display: "grid",
    gap: 6,
  },
  ftuxWelcome: {
    margin: 0,
    fontSize: 16,
    fontWeight: 650,
    color: sanctuaryTheme.cream,
  },
  ftuxTeaser: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.72)",
  },
  ftuxActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  ftuxPrimary: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 13,
  },
  ftuxDismiss: {
    border: "none",
    background: "transparent",
    color: "rgba(248, 239, 231, 0.55)",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 13,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 12,
  },
  virtualList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
  },
  virtualItem: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    listStyle: "none",
    margin: 0,
    padding: 0,
    paddingBottom: 14,
  },
  card: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 16,
    background: "rgba(26, 21, 18, 0.42)",
    backdropFilter: "blur(8px)",
    padding: 16,
    display: "grid",
    gap: 8,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  sealBadge: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#e8d4ff",
    border: "1px solid rgba(200, 170, 255, 0.35)",
    borderRadius: 999,
    padding: "3px 8px",
    whiteSpace: "nowrap",
  },
  thumbRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    objectFit: "cover",
    border: "1px solid rgba(232, 220, 208, 0.12)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    color: sanctuaryTheme.inkSoft,
    fontSize: 12,
  },
  pinButton: {
    border: "1px solid rgba(196, 149, 106, 0.35)",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    color: sanctuaryTheme.cream,
    flex: 1,
    minWidth: 0,
  },
  preview: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.78)",
    lineHeight: 1.6,
  },
  primaryButton: {
    justifySelf: "start",
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    minHeight: 18,
    color: "rgba(248, 239, 231, 0.55)",
    fontSize: 13,
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
  },
  flowCard: {
    display: "grid",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(196, 149, 106, 0.35)",
    background: "rgba(26, 20, 18, 0.72)",
  },
  flowTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: sanctuaryTheme.cream,
  },
  flowBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(248, 239, 231, 0.78)",
  },
  flowCta: {
    justifySelf: "start",
    minHeight: 44,
    border: "1px solid rgba(196, 149, 106, 0.45)",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
  },
  syncBanner: {
    display: "grid",
    gap: 10,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(196, 149, 106, 0.28)",
    background: "rgba(26, 20, 18, 0.72)",
  },
  syncBannerText: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.82)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  memoryGuardBanner: {
    borderRadius: 12,
    border: "1px solid rgba(217, 166, 122, 0.25)",
    background: "rgba(217, 166, 122, 0.08)",
    padding: "10px 12px",
  },
  syncBannerHint: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.55)",
    fontSize: 13,
    lineHeight: 1.4,
  },
  syncRetryBtn: {
    justifySelf: "start",
    border: "1px solid rgba(196, 149, 106, 0.45)",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
};
