import { useMemo, useState } from "react";
import { NfcGuideModal } from "./NfcGuideModal";
import { FIRST_TIME_ONBOARDING_CONTENT } from "../content/firstTimeOnboardingContent";

/**
 * FirstTimeOnboarding
 * - Warm, simple, non-technical first-use walkthrough.
 * - Users can skip, finish, or open again later from Home.
 */
export function FirstTimeOnboarding({
  open,
  locale = "en",
  onComplete,
  onSkip,
}) {
  const t = useMemo(
    () => FIRST_TIME_ONBOARDING_CONTENT[locale] || FIRST_TIME_ONBOARDING_CONTENT.en,
    [locale]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [showNfcGuide, setShowNfcGuide] = useState(false);

  if (!open) return null;
  const step = t.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === t.steps.length - 1;

  return (
    <>
      <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <section style={styles.modal}>
          <header style={styles.header}>
            <p style={styles.kicker}>
              {t.stepLabelPrefix}
              {stepIndex + 1}
              {t.stepLabelMiddle}
              {t.steps.length}
            </p>
            <h2 id="onboarding-title" style={styles.title}>
              {t.title}
            </h2>
            <p style={styles.subtitle}>{t.subtitle}</p>
          </header>

          <article style={styles.card}>
            <div style={styles.stepIconWrap} aria-hidden>
              <span style={styles.stepIcon}>{step.icon}</span>
            </div>
            <h3 style={styles.stepTitle}>{step.title}</h3>
            <p style={styles.stepBody}>{step.body}</p>

            {step.id === "entry-url" ? (
              <button
                type="button"
                onClick={() => setShowNfcGuide(true)}
                style={styles.inlineButton}
              >
                {t.openNfcGuide}
              </button>
            ) : null}
          </article>

          <footer style={styles.footer}>
            <button type="button" onClick={onSkip} style={styles.skipButton}>
              {t.skip}
            </button>
            <div style={styles.navActions}>
              {!isFirst ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  style={styles.secondaryButton}
                >
                  {t.back}
                </button>
              ) : null}
              {!isLast ? (
                <button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.min(t.steps.length - 1, prev + 1))}
                  style={styles.primaryButton}
                >
                  {t.next}
                </button>
              ) : (
                <button type="button" onClick={onComplete} style={styles.primaryButton}>
                  {t.start}
                </button>
              )}
            </div>
          </footer>
        </section>
      </div>

      <NfcGuideModal
        open={showNfcGuide}
        locale={locale}
        onClose={() => setShowNfcGuide(false)}
        onShowLater={() => setShowNfcGuide(false)}
      />
    </>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 70,
    background: "rgba(8, 7, 6, 0.72)",
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 22,
    border: "1px solid #4b3931",
    background: "linear-gradient(180deg, #1b1512 0%, #120f0e 100%)",
    color: "#f8efe7",
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  header: { display: "grid", gap: 6 },
  kicker: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 12,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.2,
    fontWeight: 650,
  },
  subtitle: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 16,
    lineHeight: 1.6,
  },
  card: {
    border: "1px solid #3d2f28",
    borderRadius: 16,
    background: "#171210",
    padding: 16,
    display: "grid",
    gap: 10,
  },
  stepIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "rgba(240, 194, 158, 0.15)",
    display: "grid",
    placeItems: "center",
  },
  stepIcon: { fontSize: 30, lineHeight: 1 },
  stepTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.25,
    fontWeight: 650,
  },
  stepBody: {
    margin: 0,
    color: "#f4dfcf",
    fontSize: 19,
    lineHeight: 1.65,
  },
  inlineButton: {
    justifySelf: "start",
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "10px 14px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  skipButton: {
    border: "none",
    background: "transparent",
    color: "#d9c3b3",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
  },
  navActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  secondaryButton: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
};
