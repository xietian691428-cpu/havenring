import { useEffect, useMemo, useState } from "react";
import { getNfcTroubleshootingContent } from "../content/nfcTroubleshootingContent";
import { usePlatformTarget } from "../hooks/usePlatformTarget";

/**
 * NfcTroubleshooting
 * Warm accordion-style FAQ with plain language actions.
 */
export function NfcTroubleshooting({ locale = "en", platform }) {
  const detectedPlatform = usePlatformTarget();
  const platformTarget = platform || detectedPlatform;
  const t = useMemo(
    () => getNfcTroubleshootingContent(locale, platformTarget),
    [locale, platformTarget]
  );
  const [openId, setOpenId] = useState(t.items[0]?.id || null);

  useEffect(() => {
    setOpenId(t.items[0]?.id || null);
  }, [t]);

  return (
    <section style={styles.wrapper} aria-label={t.sectionAriaLabel}>
      <header style={styles.header}>
        <h3 style={styles.title}>{t.title}</h3>
        <p style={styles.subtitle}>{t.subtitle}</p>
      </header>

      <div style={styles.list}>
        {t.items.map((item) => {
          const expanded = openId === item.id;
          return (
            <article key={item.id} style={styles.item}>
              <button
                type="button"
                onClick={() => setOpenId(expanded ? null : item.id)}
                aria-expanded={expanded}
                aria-controls={`faq-panel-${item.id}`}
                style={styles.questionButton}
              >
                <span style={styles.icon} aria-hidden>
                  {item.icon}
                </span>
                <span style={styles.question}>{item.question}</span>
                <span style={styles.chevron} aria-hidden>
                  {expanded ? "−" : "+"}
                </span>
              </button>

              {expanded ? (
                <div id={`faq-panel-${item.id}`} style={styles.answerWrap}>
                  <p style={styles.answer}>{item.answer}</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

const styles = {
  wrapper: {
    border: "1px solid #46362e",
    borderRadius: 18,
    background: "#171210",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  header: { display: "grid", gap: 5 },
  title: {
    margin: 0,
    color: "#f8efe7",
    fontSize: 28,
    fontWeight: 650,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 16,
    lineHeight: 1.6,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  item: {
    border: "1px solid #3b2d26",
    borderRadius: 12,
    background: "#1b1512",
    overflow: "hidden",
  },
  questionButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#f8efe7",
    display: "grid",
    gridTemplateColumns: "28px 1fr 20px",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
    padding: 12,
    cursor: "pointer",
  },
  icon: { fontSize: 20, lineHeight: 1 },
  question: {
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1.35,
  },
  chevron: {
    fontSize: 22,
    color: "#f0c29e",
    textAlign: "right",
  },
  answerWrap: {
    borderTop: "1px solid #3b2d26",
    padding: "10px 12px 12px 48px",
    background: "#191310",
  },
  answer: {
    margin: 0,
    color: "#f4dfcf",
    fontSize: 17,
    lineHeight: 1.7,
  },
};
