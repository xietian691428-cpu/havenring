import { useState } from "react";
import { FirstTimeOnboarding } from "../components/FirstTimeOnboarding";
import { NfcGuideModal } from "../components/NfcGuideModal";
import { NfcTroubleshooting } from "../components/NfcTroubleshooting";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { HELP_FAQ } from "../content/helpFaq";
import { getHelpCenterContent } from "../content/helpCenterContent";
import { usePlatformTarget } from "../hooks/usePlatformTarget";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * HelpCenterPage
 * Warm one-stop support center for first-time and daily guidance.
 */
export function HelpCenterPage({ onBack, locale = "en" }) {
  const platform = usePlatformTarget();
  const t = getHelpCenterContent(locale, platform);
  const faqItems = HELP_FAQ[locale] || HELP_FAQ.en;
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [nfcGuideOpen, setNfcGuideOpen] = useState(false);

  return (
    <>
      <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
        <section style={styles.shell}>
          <header style={styles.header}>
            <div>
              <p style={styles.brand}>{t.brand}</p>
              <h1 style={styles.title}>{t.title}</h1>
              <p style={styles.subtitle}>{t.subtitle}</p>
              <p style={styles.copy}>{t.layeredCoreLine}</p>
            </div>
            <OnlineStatusBadge locale={locale} />
          </header>

          <button type="button" onClick={onBack} style={styles.backButton}>
            {t.back}
          </button>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.quickTitle}</h2>
            <p style={styles.copy}>{t.quickBody}</p>
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              style={styles.primaryButton}
            >
              {t.quickCta}
            </button>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.tapTitle}</h2>
            <p style={styles.copy}>{t.tapBody}</p>
            <button
              type="button"
              onClick={() => setNfcGuideOpen(true)}
              style={styles.primaryButton}
            >
              {t.tapCta}
            </button>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.troubleshootingTitle}</h2>
            <p style={styles.copy}>{t.troubleshootingBody}</p>
            <NfcTroubleshooting locale={locale} platform={platform} />
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.riskOpsTitle}</h2>
            <p style={styles.copy}>{t.riskOpsBody}</p>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.faqTitle}</h2>
            <div style={styles.faqList}>
              {faqItems.map((item) => (
                <article key={item.q} style={styles.faqItem}>
                  <h3 style={styles.faqQuestion}>{item.q}</h3>
                  <p style={styles.faqAnswer}>{item.a}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{t.contactTitle}</h2>
            <p style={styles.copy}>{t.contactBody}</p>
            <a href={`mailto:${t.supportEmail}`} style={styles.supportLink}>
              {t.supportEmail}
            </a>
          </section>
        </section>
      </main>

      <FirstTimeOnboarding
        open={onboardingOpen}
        locale={locale}
        onComplete={() => setOnboardingOpen(false)}
        onSkip={() => setOnboardingOpen(false)}
      />
      <NfcGuideModal
        open={nfcGuideOpen}
        locale={locale}
        onClose={() => setNfcGuideOpen(false)}
        onShowLater={() => setNfcGuideOpen(false)}
      />
    </>
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
    maxWidth: 900,
    margin: "0 auto",
    display: "grid",
    gap: 12,
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
    fontSize: 32,
    fontWeight: 650,
    lineHeight: 1.2,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "#e4ccbc",
    lineHeight: 1.65,
    maxWidth: 680,
  },
  backButton: {
    justifySelf: "start",
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  card: {
    border: "1px solid rgba(232, 220, 208, 0.14)",
    borderRadius: 14,
    background: "rgba(26, 21, 18, 0.42)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.3,
    fontWeight: 650,
  },
  copy: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.65,
    fontSize: 16,
  },
  primaryButton: {
    justifySelf: "start",
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  faqList: {
    display: "grid",
    gap: 10,
  },
  faqItem: {
    border: "1px solid #3a2d28",
    borderRadius: 12,
    padding: 10,
    background: "#1a1412",
    display: "grid",
    gap: 5,
  },
  faqQuestion: {
    margin: 0,
    fontSize: 17,
    color: "#f8efe7",
    lineHeight: 1.45,
  },
  faqAnswer: {
    margin: 0,
    color: "#e4ccbc",
    lineHeight: 1.65,
    fontSize: 15,
  },
  supportLink: {
    color: "#f0c29e",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 16,
  },
};
