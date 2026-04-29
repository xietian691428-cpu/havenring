import { useMemo } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { EXPLORE_PAGE_CONTENT } from "../content/explorePageContent";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * Explore — On This Day + future AI insights (placeholder).
 */
export function ExplorePage({
  locale = "en",
  memories = [],
}) {
  const t = EXPLORE_PAGE_CONTENT[locale] || EXPLORE_PAGE_CONTENT.en;

  const onThisDay = useMemo(() => {
    const now = new Date();
    const m0 = now.getMonth();
    const d0 = now.getDate();
    return memories.filter((mem) => {
      const d = new Date(mem.timelineAt);
      return d.getMonth() === m0 && d.getDate() === d0;
    });
  }, [memories]);

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{t.brand}</p>
            <h1 style={styles.title}>{t.title}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <article style={styles.card}>
          <h2 style={styles.cardTitle}>{t.onThisDayTitle}</h2>
          <p style={styles.cardBody}>{t.onThisDayBody}</p>
          {onThisDay.length ? (
            <ul style={styles.miniList}>
              {onThisDay.map((m) => (
                <li key={m.id} style={styles.miniItem}>
                  <span style={styles.miniYear}>
                    {new Date(m.timelineAt).getFullYear()}
                  </span>
                  <span>{m.title || "—"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={styles.muted}>{t.onThisDayEmpty}</p>
          )}
        </article>

        <article style={{ ...styles.card, ...styles.cardMuted }}>
          <h2 style={styles.cardTitle}>{t.aiTitle}</h2>
          <p style={styles.cardBody}>{t.aiBody}</p>
          <p style={styles.hint}>{t.aiHint}</p>
        </article>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "20px 20px calc(28px + env(safe-area-inset-bottom, 0px))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  brand: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: sanctuaryTheme.accentSoft,
  },
  title: {
    margin: "6px 0 0",
    fontSize: 28,
    fontWeight: 500,
    color: sanctuaryTheme.cream,
  },
  card: {
    borderRadius: sanctuaryTheme.radiusLg,
    border: `1px solid rgba(232, 220, 208, 0.12)`,
    background: "rgba(44, 36, 31, 0.35)",
    backdropFilter: "blur(10px)",
    padding: 18,
    display: "grid",
    gap: 10,
  },
  cardMuted: {
    borderColor: "rgba(196, 149, 106, 0.15)",
    background: "rgba(26, 21, 18, 0.45)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    color: sanctuaryTheme.creamMuted,
  },
  cardBody: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.88)",
  },
  muted: {
    margin: 0,
    fontSize: 14,
    color: sanctuaryTheme.inkSoft,
  },
  miniList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 8,
  },
  miniItem: {
    display: "flex",
    gap: 12,
    alignItems: "baseline",
    fontSize: 15,
    color: sanctuaryTheme.creamMuted,
  },
  miniYear: {
    fontSize: 12,
    letterSpacing: "0.08em",
    color: sanctuaryTheme.accent,
    minWidth: 44,
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: sanctuaryTheme.inkSoft,
    fontStyle: "italic",
  },
};
