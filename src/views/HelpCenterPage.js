import { useMemo, useState } from "react";
import { NfcGuideModal } from "../components/NfcGuideModal";
import { NfcTroubleshooting } from "../components/NfcTroubleshooting";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { HELP_FAQ } from "../content/helpFaq";
import { getHelpCenterContent } from "../content/helpCenterContent";
import { usePlatformTarget } from "../hooks/usePlatformTarget";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

function normalizeSearch(s) {
  return String(s || "")
    .toLowerCase()
    .trim();
}

/**
 * Help center — havenCopy-driven categories, accordions, and deep links.
 */
export function HelpCenterPage({
  onBack,
  locale = "en",
  onOpenRings,
  onOpenSettings,
  onOpenPricing,
}) {
  const platform = usePlatformTarget();
  const t = getHelpCenterContent(locale, platform);
  const faqItems = HELP_FAQ[locale] || HELP_FAQ.en;
  const [nfcGuideOpen, setNfcGuideOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [openSection, setOpenSection] = useState("how");

  const q = normalizeSearch(search);

  const sections = useMemo(
    () => [
      {
        id: "how",
        title: t.categoryHowTitle,
        subtitle: t.categoryHowSubtitle,
        keywords: "how table ring face daily seal export",
        body: (
          <>
            <p style={styles.muted}>{t.howHavenWorksIntro}</p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>{t.actionLabel}</th>
                    <th style={styles.th}>{t.ringRequiredLabel}</th>
                    <th style={styles.th}>{t.recommendedLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {(t.howHavenWorksRows || []).map((row) => (
                    <tr key={row.operation}>
                      <td style={styles.td}>{row.operation}</td>
                      <td style={styles.td}>{row.ringRequired}</td>
                      <td style={styles.td}>{row.recommended}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={styles.muted}>{t.howHavenWorksOneLine}</p>
          </>
        ),
      },
      {
        id: "ritual",
        title: t.categoryRitualTitle,
        subtitle: t.categoryRitualSubtitle,
        keywords: "nfc tap ring seal ios android placement",
        body: (
          <>
            <p style={styles.muted}>{t.tapBody}</p>
            <button type="button" onClick={() => setNfcGuideOpen(true)} style={styles.primaryButton}>
              {t.tapCta}
            </button>
          </>
        ),
      },
      {
        id: "privacy",
        title: t.categoryPrivacyTitle,
        subtitle: t.categoryPrivacySubtitle,
        keywords: "privacy security export delete verification local",
        body: (
          <>
            <p style={styles.muted}>{t.layeredCoreLine}</p>
            <p style={styles.muted}>{t.riskOpsBody}</p>
            <div style={styles.linkRow}>
              <button type="button" onClick={() => onOpenSettings?.()} style={styles.linkish}>
                {t.linkSettingsCta}
              </button>
            </div>
          </>
        ),
      },
      {
        id: "billing",
        title: t.categoryBillingTitle,
        subtitle: t.categoryBillingSubtitle,
        keywords: "plus subscription trial cancel billing upgrade",
        body: (
          <>
            <p style={styles.muted}>{t.categoryBillingBody}</p>
            <div style={styles.linkRow}>
              <button type="button" onClick={() => onOpenPricing?.()} style={styles.primaryButton}>
                {t.linkPricingCta}
              </button>
            </div>
          </>
        ),
      },
      {
        id: "trouble",
        title: t.categoryTroubleTitle,
        subtitle: t.categoryTroubleSubtitle,
        keywords: "trouble nfc lost ring revoke fix",
        body: (
          <>
            <p style={styles.muted}>{t.troubleshootingBody}</p>
            <NfcTroubleshooting locale={locale} platform={platform} />
            <div style={styles.linkRow}>
              <button type="button" onClick={() => onOpenRings?.()} style={styles.linkish}>
                {t.linkRingsCta}
              </button>
            </div>
          </>
        ),
      },
    ],
    [locale, onOpenPricing, onOpenRings, onOpenSettings, platform, t]
  );

  const filteredSections = useMemo(() => {
    if (!q) return sections;
    return sections.filter((s) => {
      const blob = normalizeSearch(`${s.title} ${s.subtitle} ${s.keywords}`);
      return blob.includes(q);
    });
  }, [q, sections]);

  const filteredFaq = useMemo(() => {
    if (!q) return faqItems;
    return faqItems.filter((item) => {
      const blob = normalizeSearch(`${item.q} ${item.a}`);
      return blob.includes(q);
    });
  }, [faqItems, q]);

  return (
    <>
      <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
        <section style={styles.shell}>
          <header style={styles.header}>
            <div>
              <p style={styles.brand}>{t.brand}</p>
              <h1 style={styles.title}>{t.title}</h1>
              <p style={styles.subtitle}>{t.subtitle}</p>
            </div>
            <OnlineStatusBadge locale={locale} />
          </header>

          <button type="button" onClick={onBack} style={styles.backButton}>
            {t.back}
          </button>

          <label style={styles.searchWrap}>
            <span style={styles.srOnly}>{t.searchPlaceholder}</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={styles.searchInput}
              autoComplete="off"
            />
          </label>

          <div style={styles.stack}>
            {filteredSections.map((section) => {
              const open = openSection === section.id;
              return (
                <section key={section.id} style={styles.card}>
                  <button
                    type="button"
                    style={styles.accBtn}
                    aria-expanded={open}
                    onClick={() => setOpenSection(open ? "" : section.id)}
                  >
                    <span>
                      <span style={styles.accTitle}>{section.title}</span>
                      <span style={styles.accSub}>{section.subtitle}</span>
                    </span>
                    <span style={styles.accChev}>{open ? "−" : "+"}</span>
                  </button>
                  {open ? <div style={styles.accBody}>{section.body}</div> : null}
                </section>
              );
            })}
          </div>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.faqTitle}</h2>
            <div style={styles.stack}>
              {filteredFaq.length ? (
                filteredFaq.map((item) => (
                  <FaqAccordion key={item.q} q={item.q} a={item.a} />
                ))
              ) : (
                <p style={styles.muted}>—</p>
              )}
            </div>
          </section>

          <footer style={styles.footer}>
            <p style={styles.footerLead}>{t.footerQuestions}</p>
            <p style={styles.muted}>{t.footerEmailLine}</p>
            <a href={`mailto:${t.supportEmail}`} style={styles.supportLink}>
              {t.supportEmail}
            </a>
          </footer>
        </section>
      </main>

      <NfcGuideModal
        open={nfcGuideOpen}
        locale={locale}
        onClose={() => setNfcGuideOpen(false)}
        onShowLater={() => setNfcGuideOpen(false)}
      />
    </>
  );
}

function FaqAccordion({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={styles.faqCard}>
      <button type="button" style={styles.faqQ} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {q}
        <span style={styles.accChev} aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? <p style={styles.faqA}>{a}</p> : null}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 20,
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
  brand: {
    margin: 0,
    color: sanctuaryTheme.accentSoft,
    fontSize: 12,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
  },
  title: {
    margin: "8px 0 0",
    fontSize: 30,
    fontWeight: 650,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "rgba(248, 239, 231, 0.72)",
    lineHeight: 1.6,
    maxWidth: 640,
    fontSize: 15,
  },
  backButton: {
    justifySelf: "start",
    border: "1px solid rgba(232, 220, 208, 0.18)",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  searchWrap: {
    display: "block",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
  },
  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid rgba(232, 220, 208, 0.14)",
    background: "rgba(18, 14, 12, 0.55)",
    color: sanctuaryTheme.cream,
    padding: "10px 12px",
    fontSize: 15,
  },
  stack: {
    display: "grid",
    gap: 10,
  },
  card: {
    border: "1px solid rgba(232, 220, 208, 0.14)",
    borderRadius: 14,
    background: "rgba(26, 21, 18, 0.42)",
    padding: 12,
    display: "grid",
    gap: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 650,
  },
  accBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.cream,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    cursor: "pointer",
    textAlign: "left",
    padding: 4,
  },
  accTitle: {
    display: "block",
    fontSize: 17,
    fontWeight: 650,
  },
  accSub: {
    display: "block",
    marginTop: 4,
    fontSize: 13,
    color: "rgba(248, 239, 231, 0.6)",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  accChev: {
    flexShrink: 0,
    color: sanctuaryTheme.accentSoft,
    fontSize: 20,
    lineHeight: 1,
  },
  accBody: {
    padding: "4px 4px 2px",
    display: "grid",
    gap: 10,
  },
  muted: {
    margin: 0,
    color: "rgba(248, 239, 231, 0.72)",
    lineHeight: 1.65,
    fontSize: 15,
  },
  primaryButton: {
    justifySelf: "start",
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 14,
  },
  linkRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  linkish: {
    border: "1px solid rgba(232, 220, 208, 0.22)",
    background: "transparent",
    color: sanctuaryTheme.accentSoft,
    borderRadius: 999,
    padding: "8px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    textDecoration: "underline",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 520,
  },
  th: {
    textAlign: "left",
    fontSize: 12,
    color: sanctuaryTheme.accentSoft,
    borderBottom: "1px solid rgba(232, 220, 208, 0.18)",
    padding: "8px 10px",
  },
  td: {
    fontSize: 14,
    color: "rgba(248, 239, 231, 0.85)",
    borderBottom: "1px solid rgba(40, 32, 28, 0.9)",
    padding: "8px 10px",
    lineHeight: 1.45,
    verticalAlign: "top",
  },
  faqCard: {
    border: "1px solid rgba(232, 220, 208, 0.1)",
    borderRadius: 12,
    background: "rgba(20, 16, 14, 0.35)",
    overflow: "hidden",
  },
  faqQ: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.cream,
    padding: "12px 14px",
    fontSize: 15,
    fontWeight: 600,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  faqA: {
    margin: 0,
    padding: "0 14px 12px",
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(248, 239, 231, 0.72)",
  },
  footer: {
    textAlign: "center",
    padding: "20px 8px 32px",
    display: "grid",
    gap: 8,
    justifyItems: "center",
  },
  footerLead: {
    margin: 0,
    fontSize: 17,
    fontWeight: 650,
  },
  supportLink: {
    color: sanctuaryTheme.accentSoft,
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 16,
  },
};
