import { useEffect, useMemo, useState } from "react";
import { NfcGuideModal } from "./NfcGuideModal";
import { FIRST_TIME_ONBOARDING_CONTENT } from "../content/firstTimeOnboardingContent";
import { resolvePlatformTarget } from "../hooks/usePlatformTarget";
import { trackFirstRunEvent } from "../services/firstRunTelemetryService";

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
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const onboardingEventLocale = locale;
  const [openedTracked, setOpenedTracked] = useState(false);

  useEffect(() => {
    if (!open || openedTracked) return;
    setOpenedTracked(true);
    void trackFirstRunEvent("onboarding_opened", {
      locale: onboardingEventLocale,
      platform,
    });
  }, [open, openedTracked, onboardingEventLocale, platform]);

  function handleSkip() {
    void trackFirstRunEvent("onboarding_skipped", {
      locale: onboardingEventLocale,
      platform,
      metadata: { step: stepIndex + 1 },
    });
    onSkip?.();
  }

  function handleComplete() {
    void trackFirstRunEvent("onboarding_completed", {
      locale: onboardingEventLocale,
      platform,
    });
    onComplete?.();
  }

  function handlePrimaryAction(step, isLastStep) {
    if (step?.action === "open-ring-guide") {
      setShowNfcGuide(true);
      return;
    }
    if (isLastStep) {
      handleComplete();
      return;
    }
    setStepIndex((prev) => Math.min(t.steps.length - 1, prev + 1));
  }

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
            <p style={styles.platformHint}>
              {platform === "android" ? t.platformHintAndroid : t.platformHintIos}
            </p>
          </header>

          <article style={styles.card}>
            <div style={styles.illustrationWrap} aria-hidden>
              {renderOnboardingIllustration(step.illustration || "welcome")}
            </div>
            <h3 style={styles.stepTitle}>{step.title}</h3>
            <p style={styles.stepBody}>{step.body}</p>
            {step.subtitle ? <p style={styles.stepSubline}>{step.subtitle}</p> : null}
          </article>

          <footer style={styles.footer}>
            <button type="button" onClick={handleSkip} style={styles.skipButton}>
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
                  onClick={() => handlePrimaryAction(step, false)}
                  style={styles.primaryButton}
                >
                  {step.primaryButton || t.next}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePrimaryAction(step, true)}
                  style={styles.primaryButton}
                >
                  {step.primaryButton || t.start}
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

function renderOnboardingIllustration(kind) {
  if (kind === "guardian") {
    return (
      <div style={styles.artBoard}>
        <div style={styles.faceFrame}>◉</div>
        <div style={styles.lockBadge}>🔒</div>
      </div>
    );
  }
  if (kind === "ring-key") {
    return (
      <div style={styles.artBoard}>
        <div style={styles.ringHalo}>💍</div>
        <div style={styles.ringSpark}>✦</div>
      </div>
    );
  }
  if (kind === "draft-vs-seal") {
    return (
      <div style={styles.artBoard}>
        <div style={styles.compareRow}>
          <div style={styles.compareCard}>Draft</div>
          <div style={styles.compareArrow}>→</div>
          <div style={styles.compareSeal}>Seal</div>
        </div>
      </div>
    );
  }
  if (kind === "ownership") {
    return (
      <div style={styles.artBoard}>
        <div style={styles.vaultCircle}>🛡</div>
        <div style={styles.vaultText}>E2E</div>
      </div>
    );
  }
  return (
    <div style={styles.artBoard}>
      <div style={styles.welcomeGlow}>✧</div>
      <div style={styles.welcomeText}>Haven</div>
    </div>
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
  platformHint: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 13,
    lineHeight: 1.5,
  },
  card: {
    border: "1px solid #3d2f28",
    borderRadius: 16,
    background: "#171210",
    padding: 16,
    display: "grid",
    gap: 10,
  },
  illustrationWrap: { display: "grid", justifyItems: "start" },
  artBoard: {
    minHeight: 68,
    minWidth: 180,
    border: "1px solid #3d2f28",
    borderRadius: 14,
    padding: "10px 12px",
    background: "rgba(240, 194, 158, 0.06)",
    display: "grid",
    alignItems: "center",
  },
  faceFrame: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: "1px solid #c4956a",
    color: "#f0c29e",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
  },
  lockBadge: { fontSize: 20, marginTop: 4 },
  ringHalo: { fontSize: 30, color: "#f0c29e" },
  ringSpark: { fontSize: 16, color: "#f7dcc8" },
  compareRow: { display: "flex", alignItems: "center", gap: 8 },
  compareCard: {
    border: "1px solid #5b4438",
    borderRadius: 999,
    padding: "4px 10px",
    color: "#d9c3b3",
    fontSize: 12,
  },
  compareArrow: { color: "#f0c29e", fontSize: 14 },
  compareSeal: {
    border: "1px solid #d9a67a",
    borderRadius: 999,
    padding: "4px 10px",
    color: "#f8efe7",
    fontSize: 12,
    background: "rgba(217, 166, 122, 0.18)",
  },
  vaultCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid #8cb3d8",
    display: "grid",
    placeItems: "center",
    color: "#cfe6fb",
    fontSize: 20,
  },
  vaultText: {
    marginTop: 4,
    color: "#cfe6fb",
    fontSize: 12,
    letterSpacing: "0.08em",
  },
  welcomeGlow: { color: "#f0c29e", fontSize: 20 },
  welcomeText: { color: "#f8efe7", fontSize: 14, letterSpacing: "0.06em" },
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
  stepSubline: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 14,
    lineHeight: 1.55,
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
