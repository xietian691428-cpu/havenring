import { useEffect, useMemo, useRef, useState } from "react";
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

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{t.title}</h1>
            {ordered.length ? <p style={styles.tagline}>{t.tagline}</p> : null}
          </div>
          <div style={styles.headerActions}>
            <button type="button" onClick={onCreateMemory} style={styles.createButton}>
              {t.fabSealNew || t.create}
            </button>
          </div>
        </header>

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !ordered.length ? (
          <p style={styles.feedback}>{t.empty}</p>
        ) : null}

        <ol style={styles.list}>
          {ordered.map((memory) => {
            const pinned = pinnedId === memory.id;
            const locked = Number(memory?.releaseAt || 0) > Date.now();
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
                <h3 style={styles.cardTitle}>
                  {pinned ? "📌 " : ""}
                  {memory.title || t.untitled}
                </h3>
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

        <p style={styles.feedback}>{notice || "\u00A0"}</p>
      </section>
    </main>
  );
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
