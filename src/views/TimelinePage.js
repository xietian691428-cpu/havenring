import { useEffect, useMemo, useRef, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { triggerSuccessFeedback } from "../utils/feedbackEffects";
import { TIMELINE_PAGE_CONTENT } from "../content/timelinePageContent";

/**
 * Timeline Page
 * - Descending date cards
 * - Supports one pinned memory in UI
 * - Friendly offline notice
 */
export function TimelinePage({
  memories = [],
  loading = false,
  error = "",
  onOpenMemory,
  onOpenMemoryFromRing,
  onCreateNew,
  onOpenSettings,
  onBackHome,
  locale = "en",
}) {
  const t = TIMELINE_PAGE_CONTENT[locale] || TIMELINE_PAGE_CONTENT.en;
  const [pinnedId, setPinnedId] = useState(null);
  const [notice, setNotice] = useState("");
  const ringHandledRef = useRef(false);
  const { soundEnabled, hapticEnabled, soundScope } = useFeedbackPrefs();
  const isOffline = typeof navigator !== "undefined" ? !navigator.onLine : false;

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
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{t.title}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <div style={styles.topActions}>
          <button type="button" onClick={onBackHome} style={styles.ghostButton}>
            {t.back}
          </button>
          <button type="button" onClick={onCreateNew} style={styles.secondaryButton}>
            {t.create}
          </button>
          <button type="button" onClick={onOpenSettings} style={styles.ghostButton}>
            {t.settings}
          </button>
        </div>

        {isOffline ? (
          <p style={styles.offlineTip}>
            {t.offlineTip}
          </p>
        ) : null}

        {loading ? <p style={styles.feedback}>{t.loading}</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}
        {!loading && !ordered.length ? (
          <p style={styles.feedback}>{t.empty}</p>
        ) : null}

        <ol style={styles.list}>
          {ordered.map((memory) => {
            const pinned = pinnedId === memory.id;
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
                <p style={styles.preview}>{memory.story || t.noStory}</p>
                <button
                  type="button"
                  onClick={() => onOpenMemory?.(memory.id)}
                  style={styles.primaryButton}
                  disabled={loading}
                >
                  {t.open}
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
    padding: 20,
    background: "radial-gradient(circle at top, #261b17 0%, #120f0e 58%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
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
  brand: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 30,
    fontWeight: 500,
  },
  topActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  ghostButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #d9a67a",
    background: "transparent",
    color: "#f0c29e",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  offlineTip: {
    margin: 0,
    padding: "10px 12px",
    border: "1px solid #6b4a39",
    borderRadius: 10,
    background: "rgba(217, 166, 122, 0.08)",
    color: "#f2d8c5",
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 12,
  },
  card: {
    border: "1px solid #3a2d28",
    borderRadius: 14,
    background: "#171210",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    color: "#d9c3b3",
  },
  pinButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f3c6a5",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
  },
  preview: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
  },
  primaryButton: {
    justifySelf: "start",
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
    opacity: 1,
  },
  feedback: {
    margin: 0,
    minHeight: 18,
    color: "#f2d8c5",
    fontSize: 13,
  },
  error: {
    margin: 0,
    color: "#ffb8a3",
  },
};
