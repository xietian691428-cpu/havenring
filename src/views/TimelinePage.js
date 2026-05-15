import { useEffect, useMemo, useRef, useState } from "react";
import {
  isFirstMemoryCompleted,
  ONBOARDING_DONE_KEY,
  TIMELINE_TRY_SEAL_HINT_DISMISSED_KEY,
} from "../services/firstRunTelemetryService";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { TIMELINE_PAGE_CONTENT } from "../content/timelinePageContent";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * Timeline — primary “memory space” view; photo-forward cards on warm canvas.
 */
export function TimelinePage({
  memories = [],
  loading = false,
  error = "",
  onOpenMemory,
  onOpenMemoryFromRing,
  onCreateMemory,
  locale = "en",
}) {
  const t = TIMELINE_PAGE_CONTENT[locale] || TIMELINE_PAGE_CONTENT.en;
  const [pinnedId, setPinnedId] = useState(null);
  const [notice, setNotice] = useState("");
  const ringHandledRef = useRef(false);
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();

  const [hintHidden, setHintHidden] = useState(false);

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

  const orderedFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((m) => {
      const title = String(m.title || "").toLowerCase();
      const story = String(m.story || "").toLowerCase();
      const d = new Date(m.timelineAt).toLocaleString().toLowerCase();
      return title.includes(q) || story.includes(q) || d.includes(q);
    });
  }, [ordered, searchQuery]);

  const showHeroWhenEmpty =
    !loading && !searchQuery && !ordered.length && !showPostFtuxBanner;

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
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

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !orderedFiltered.length ? (
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
                <button type="button" onClick={() => onCreateMemory?.()} style={styles.secondaryGhost}>
                  {t.emptySecondaryCta}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <ol style={styles.list}>
          {orderedFiltered.map((memory) => {
            const pinned = pinnedId === memory.id;
            const locked = Number(memory?.releaseAt || 0) > viewerNow;
            const sealed = isTimelineMemorySealed(memory);
            const thumbs = getMemoryThumbnails(memory);
            return (
              <li key={memory.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <small style={styles.date}>
                    {new Date(memory.timelineAt).toLocaleString()}
                  </small>
                  <button
                    type="button"
                    onClick={() => togglePin(memory.id)}
                    style={styles.pinButton}
                  >
                    {pinned ? t.unpin : t.pin}
                  </button>
                </div>
                <div style={styles.titleRow}>
                  <h3 style={styles.cardTitle}>
                    {pinned ? "📌 " : ""}
                    {memory.title || t.untitled}
                  </h3>
                  {sealed ? (
                    <span style={styles.sealBadge} title={t.sealedBadge}>
                      🔒 {t.sealedBadge}
                    </span>
                  ) : null}
                </div>
                {thumbs.length ? (
                  <div style={styles.thumbRow}>
                    {thumbs.map((thumb) => (
                      <img
                        key={thumb.key}
                        src={thumb.url}
                        alt={t.thumbAlt}
                        style={styles.thumb}
                      />
                    ))}
                  </div>
                ) : null}
                <p style={styles.preview}>
                  {locked
                    ? t.capsuleLockedPreview.replace(
                        "{time}",
                        new Date(memory.releaseAt).toLocaleString()
                      )
                    : memory.story || t.noStory}
                </p>
                <button
                  type="button"
                  onClick={() => onOpenMemory?.(memory.id)}
                  style={styles.primaryButton}
                  disabled={loading || locked}
                >
                  {locked ? t.capsuleOpen : t.open}
                </button>
              </li>
            );
          })}
        </ol>

        <p style={styles.feedback}>{notice || "\u00a0"}</p>
      </section>
    </main>
  );
}

function getMemoryThumbnails(memory) {
  const raw = memory?.photos ?? memory?.photo;
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .slice(0, 3)
    .map((p, i) => {
      const url = typeof p === "string" ? p : p?.dataUrl || p?.src || p?.url || "";
      return { key: `${memory.id}-p-${i}`, url };
    })
    .filter((x) => x.url);
}

function isTimelineMemorySealed(memory) {
  return Boolean(memory?.is_sealed || memory?.ring_id);
}

const styles = {
  page: {
    minHeight: "100vh",
    padding:
      "12px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 820,
    margin: "0 auto",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
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
    padding: "28px 16px",
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
    margin: "6px 0 0",
    fontSize: 28,
    fontWeight: 500,
    color: sanctuaryTheme.cream,
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
    margin: "6px 0 0",
    fontSize: 14,
    lineHeight: 1.45,
    color: "rgba(248, 239, 231, 0.65)",
    maxWidth: 420,
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
};
