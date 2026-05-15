import { useState } from "react";
import { havenCopy } from "../content/havenCopy";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * Haven Plus — pricing & comparison (EN copy from havenCopy.pricingPage).
 */
export function PricingPage({ onBack, onStartTrial, onSubscribe }) {
  const t = havenCopy.pricingPage;
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <button type="button" onClick={onBack} style={styles.back}>
          {t.back}
        </button>
        <header style={styles.hero}>
          <p style={styles.kicker}>{t.pageTitle}</p>
          <h1 style={styles.title}>{t.heroTitle}</h1>
          <p style={styles.subtitle}>{t.heroSubtitle}</p>
          <p style={styles.trust}>{t.trustLine}</p>
        </header>

        <div style={styles.tableCard}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{t.colFeature}</th>
                <th style={styles.th}>{t.colFree}</th>
                <th style={styles.thPlus}>{t.colPlus}</th>
              </tr>
            </thead>
            <tbody>
              {t.rows.map((row) => (
                <tr key={row.feature}>
                  <td style={styles.td}>{row.feature}</td>
                  <td style={styles.td}>{row.free}</td>
                  <td style={styles.tdPlus}>{row.plus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul style={styles.footnotes}>
          <li>{t.footnoteTrial}</li>
          <li>{t.footnoteCancel}</li>
          <li>{t.footnoteBelief}</li>
        </ul>
        <p style={styles.cloudDisclaimer}>{t.cloudStorageDisclaimer}</p>
        <p style={styles.social}>{havenCopy.upgrade.upgradeTimingHint}</p>

        <div style={styles.ctaRow}>
          <button type="button" onClick={() => onStartTrial?.()} style={styles.primary}>
            {t.ctaTrial}
          </button>
          <button type="button" onClick={() => onSubscribe?.()} style={styles.secondary}>
            {t.ctaSubscribe}
          </button>
        </div>
        <p style={styles.payNote}>{t.payMethodsNote}</p>

        <section style={styles.faq}>
          <h2 style={styles.faqTitle}>{t.faqTitle}</h2>
          {t.faqs.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={item.q} style={styles.faqItem}>
                <button
                  type="button"
                  style={styles.faqQ}
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  {item.q}
                  <span style={styles.faqChev} aria-hidden>
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open ? <p style={styles.faqA}>{item.a}</p> : null}
              </div>
            );
          })}
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "12px 18px calc(88px + env(safe-area-inset-bottom, 0px))",
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 720,
    margin: "0 auto",
    display: "grid",
    gap: 16,
  },
  back: {
    justifySelf: "start",
    border: "none",
    background: "transparent",
    color: "rgba(248, 239, 231, 0.65)",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
    padding: "4px 0",
  },
  hero: {
    display: "grid",
    gap: 8,
  },
  kicker: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: sanctuaryTheme.accentSoft,
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 650,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.78)",
    maxWidth: 560,
  },
  trust: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "rgba(196, 149, 106, 0.95)",
    letterSpacing: "0.04em",
  },
  tableCard: {
    border: "1px solid rgba(232, 220, 208, 0.12)",
    borderRadius: 16,
    background: "rgba(26, 21, 18, 0.45)",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: sanctuaryTheme.accentSoft,
    borderBottom: "1px solid rgba(232, 220, 208, 0.18)",
    fontWeight: 650,
    background: "rgba(20, 16, 14, 0.6)",
  },
  thPlus: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#e8d4ff",
    borderBottom: "1px solid rgba(200, 170, 255, 0.22)",
    fontWeight: 650,
    background: "rgba(36, 28, 48, 0.55)",
  },
  td: {
    padding: "10px",
    borderBottom: "1px solid rgba(232, 220, 208, 0.08)",
    color: "rgba(248, 239, 231, 0.82)",
    verticalAlign: "top",
    lineHeight: 1.45,
  },
  tdPlus: {
    padding: "10px",
    borderBottom: "1px solid rgba(200, 170, 255, 0.1)",
    color: "rgba(240, 228, 255, 0.92)",
    verticalAlign: "top",
    lineHeight: 1.45,
    background: "rgba(32, 26, 40, 0.25)",
  },
  footnotes: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(248, 239, 231, 0.7)",
    fontSize: 13,
    lineHeight: 1.55,
    display: "grid",
    gap: 6,
  },
  cloudDisclaimer: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(248, 239, 231, 0.68)",
  },
  social: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(196, 149, 106, 0.9)",
    fontStyle: "italic",
  },
  ctaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  primary: {
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  secondary: {
    border: "1px solid rgba(196, 149, 106, 0.45)",
    background: "transparent",
    color: sanctuaryTheme.creamMuted,
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
  },
  payNote: {
    margin: 0,
    fontSize: 12,
    color: "rgba(248, 239, 231, 0.55)",
    lineHeight: 1.45,
  },
  faq: {
    display: "grid",
    gap: 8,
    marginTop: 8,
  },
  faqTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 650,
  },
  faqItem: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 12,
    background: "rgba(20, 16, 14, 0.35)",
    overflow: "hidden",
  },
  faqQ: {
    width: "100%",
    textAlign: "left",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.cream,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  faqChev: {
    color: sanctuaryTheme.accentSoft,
    flexShrink: 0,
  },
  faqA: {
    margin: 0,
    padding: "0 14px 12px",
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(248, 239, 231, 0.72)",
  },
};
