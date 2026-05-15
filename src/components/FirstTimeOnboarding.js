import { useEffect, useMemo, useRef, useState } from "react";
import { NfcGuideModal } from "./NfcGuideModal";
import { getFirstTimeOnboardingBundle } from "../content/firstTimeOnboardingContent";
import { resolvePlatformTarget } from "../hooks/usePlatformTarget";
import { trackFirstRunEvent } from "../services/firstRunTelemetryService";

/**
 * First-time onboarding (FTUX)
 * - EN: 4-step v2 flow from havenCopy (privacy → how → ritual → bind choice).
 * - Other locales: legacy 5-step layout until translated.
 */
export function FirstTimeOnboarding({
  open,
  locale = "en",
  onComplete,
  onQuickSignIn,
}) {
  const platform = useMemo(() => resolvePlatformTarget(), []);
  const t = useMemo(() => getFirstTimeOnboardingBundle(locale, platform), [locale, platform]);
  const [stepIndex, setStepIndex] = useState(0);
  const [showNfcGuide, setShowNfcGuide] = useState(false);
  const onboardingEventLocale = locale;
  const openedTrackedRef = useRef(false);

  const isV2 = t.version === "v2";
  const step = t.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === t.steps.length - 1;

  useEffect(() => {
    if (!open || openedTrackedRef.current) return;
    openedTrackedRef.current = true;
    void trackFirstRunEvent("onboarding_opened", {
      locale: onboardingEventLocale,
      platform,
    });
  }, [open, onboardingEventLocale, platform]);

  useEffect(() => {
    if (!open) return;
    // Reset step when the sheet opens (remount would be ideal; microtask avoids sync setState in render).
    queueMicrotask(() => {
      setStepIndex(0);
    });
  }, [open]);

  function finish(detail) {
    void trackFirstRunEvent("onboarding_completed", {
      locale: onboardingEventLocale,
      platform,
      metadata: detail && typeof detail === "object" ? detail : {},
    });
    onComplete?.(detail);
  }

  function handleSkip() {
    void trackFirstRunEvent("onboarding_skipped", {
      locale: onboardingEventLocale,
      platform,
      metadata: { step: stepIndex + 1 },
    });
    finish({ outcome: "skipped", step: stepIndex + 1 });
  }

  function handlePrimaryAction(isLastStep) {
    if (step?.action === "open-ring-guide") {
      setShowNfcGuide(true);
      return;
    }
    if (isV2 && step?.kind === "ready") {
      return;
    }
    if (isLastStep) {
      finish({});
      return;
    }
    setStepIndex((prev) => Math.min(t.steps.length - 1, prev + 1));
  }

  if (!open) return null;

  const skipLabel =
    isV2 && isLast && step?.kind === "ready" ? t.skipLast || t.skip : t.skip;

  return (
    <>
      <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <section style={styles.modal}>
          {isV2 ? (
            <div style={styles.topBar}>
              <div style={styles.progressDots} aria-hidden>
                {t.steps.map((s, i) => (
                  <span
                    key={s.id || String(i)}
                    style={{
                      ...styles.dot,
                      ...(i === stepIndex ? styles.dotActive : {}),
                    }}
                  />
                ))}
              </div>
              <button type="button" onClick={handleSkip} style={styles.skipTop}>
                {skipLabel}
              </button>
            </div>
          ) : null}

          {!isV2 ? (
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
          ) : (
            <h2 id="onboarding-title" style={styles.srOnly}>
              {step?.title}
            </h2>
          )}

          <article style={styles.card}>
            {isV2 && step?.kind === "privacy" ? (
              <>
                <div style={styles.illustrationWrap} aria-hidden>
                  {renderOnboardingIllustration(step.illustration || "welcome")}
                </div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                {step.subtitle ? <p style={styles.stepSubtitle}>{step.subtitle}</p> : null}
                <ul style={styles.bulletList}>
                  {(step.bullets || []).map((line) => (
                    <li key={line} style={styles.bulletItem}>
                      {line}
                    </li>
                  ))}
                </ul>
                {onQuickSignIn ? (
                  <div style={styles.signInRow}>
                    <span style={styles.signInPrompt}>{t.signInPrompt}</span>
                    <div style={styles.signInButtons}>
                      <button
                        type="button"
                        style={styles.signInBtn}
                        onClick={() => onQuickSignIn("apple")}
                      >
                        {t.signInWithApple}
                      </button>
                      <button
                        type="button"
                        style={styles.signInBtn}
                        onClick={() => onQuickSignIn("google")}
                      >
                        {t.signInWithGoogle}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {isV2 && step?.kind === "how" ? (
              <>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                {step.body ? <p style={styles.stepBodyMuted}>{step.body}</p> : null}
                <div style={styles.pillarGrid}>
                  {(step.pillars || []).map((p) => (
                    <div key={p.label} style={styles.pillarCard}>
                      <p style={styles.pillarLabel}>{p.label}</p>
                      <p style={styles.pillarText}>{p.text}</p>
                    </div>
                  ))}
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>{t.tableAction}</th>
                        <th style={styles.th}>{t.tableRingRequired}</th>
                        <th style={styles.th}>{t.tableRecommended}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(step.howRows || []).map((row) => (
                        <tr key={row.action}>
                          <td style={styles.td}>{row.action}</td>
                          <td style={styles.td}>{row.ringRequired}</td>
                          <td style={styles.td}>{row.recommended}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {isV2 && step?.kind === "ritual" ? (
              <>
                <div style={styles.illustrationWrap} aria-hidden>
                  <NfcRingTapHint platform={platform} />
                </div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                {step.body ? <p style={styles.stepBody}>{step.body}</p> : null}
                {step.subtitle ? <p style={styles.stepSubline}>{step.subtitle}</p> : null}
              </>
            ) : null}

            {isV2 && step?.kind === "ready" ? (
              <>
                <div style={styles.illustrationWrap} aria-hidden>
                  {renderOnboardingIllustration(step.illustration || "ownership")}
                </div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                {step.body ? <p style={styles.stepBody}>{step.body}</p> : null}
              </>
            ) : null}

            {!isV2 ? (
              <>
                <div style={styles.illustrationWrap} aria-hidden>
                  {renderOnboardingIllustration(step.illustration || "welcome")}
                </div>
                <h3 style={styles.stepTitle}>{step.title}</h3>
                <p style={styles.stepBody}>{step.body}</p>
                {step.subtitle ? <p style={styles.stepSubline}>{step.subtitle}</p> : null}
              </>
            ) : null}

            {isV2 ? <p style={styles.footerEcho}>{t.footerPrivacyEcho}</p> : null}
          </article>

          <footer style={styles.footer}>
            {!isV2 ? (
              <button type="button" onClick={handleSkip} style={styles.skipButton}>
                {t.skip}
              </button>
            ) : (
              <span />
            )}
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
              {isV2 && step?.kind === "ready" ? (
                <div style={styles.dualStack}>
                  <button
                    type="button"
                    onClick={() => finish({ choice: "bind_ring" })}
                    style={styles.primaryButton}
                  >
                    {step.primaryButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => finish({ choice: "face_only" })}
                    style={styles.secondaryButton}
                  >
                    {step.secondaryButton}
                  </button>
                </div>
              ) : !isLast ? (
                <button
                  type="button"
                  onClick={() => handlePrimaryAction(false)}
                  style={styles.primaryButton}
                >
                  {step.primaryButton || t.next}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePrimaryAction(true)}
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

function NfcRingTapHint({ platform }) {
  const stroke = "rgba(240,194,158,0.85)";
  const dim = "rgba(200,180,170,0.35)";
  if (platform === "ios") {
    return (
      <div style={styles.artBoard}>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.nfcSvg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="76" y="20" width="48" height="8" rx="3" fill={dim} />
          <path
            d="M100 20 L100 8 L130 8 L130 20"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="115" cy="14" r="5" fill="rgba(217,166,122,0.35)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Top — near Dynamic Island / earpiece
          </text>
        </svg>
      </div>
    );
  }
  if (platform === "android") {
    return (
      <div style={styles.artBoard}>
        <svg width="200" height="128" viewBox="0 0 200 128" style={styles.nfcSvg}>
          <rect x="56" y="12" width="88" height="104" rx="14" fill="none" stroke={dim} strokeWidth="2" />
          <rect x="72" y="22" width="56" height="36" rx="6" fill="none" stroke={dim} strokeWidth="1.5" />
          <circle cx="128" cy="40" r="10" fill="rgba(217,166,122,0.28)" stroke={stroke} strokeWidth="2" />
          <text x="100" y="118" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
            Back — NFC often near the camera
          </text>
        </svg>
      </div>
    );
  }
  return (
    <div style={styles.artBoard}>
      <svg width="200" height="96" viewBox="0 0 200 96" style={styles.nfcSvg}>
        <rect x="48" y="8" width="104" height="80" rx="12" fill="none" stroke={dim} strokeWidth="2" />
        <circle cx="100" cy="48" r="14" fill="rgba(217,166,122,0.22)" stroke={stroke} strokeWidth="2" />
        <text x="100" y="88" textAnchor="middle" fill="#cbb09f" fontSize="9" fontFamily="Inter, sans-serif">
          Hold near your device’s NFC reader
        </text>
      </svg>
    </div>
  );
}

function renderOnboardingIllustration(kind) {
  if (kind === "how-pillars") {
    return (
      <div style={styles.artBoard}>
        <div style={styles.miniRow}>
          <span style={styles.miniPill}>◇</span>
          <span style={styles.miniPill}>◉</span>
          <span style={styles.miniPill}>☁</span>
        </div>
      </div>
    );
  }
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
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 70,
    background: `
      radial-gradient(circle at 18% 28%, rgba(217,166,122,0.09) 0%, transparent 42%),
      radial-gradient(circle at 82% 18%, rgba(140,180,220,0.07) 0%, transparent 38%),
      radial-gradient(circle at 50% 88%, rgba(217,166,122,0.05) 0%, transparent 45%),
      rgba(8, 7, 6, 0.78)`,
    backdropFilter: "blur(8px)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    transition: "opacity 220ms ease-out",
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
    transition: "transform 240ms ease-out, opacity 240ms ease-out",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  progressDots: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(248, 239, 231, 0.2)",
    transition: "background 180ms ease-out, transform 180ms ease-out",
  },
  dotActive: {
    background: "rgba(240, 194, 158, 0.95)",
    transform: "scale(1.15)",
  },
  skipTop: {
    border: "none",
    background: "transparent",
    color: "#d9c3b3",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
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
    gap: 12,
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
  nfcSvg: { display: "block" },
  miniRow: { display: "flex", gap: 10, alignItems: "center" },
  miniPill: {
    fontSize: 18,
    color: "#f0c29e",
    opacity: 0.85,
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
    fontSize: 24,
    lineHeight: 1.25,
    fontWeight: 650,
  },
  stepSubtitle: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 16,
    lineHeight: 1.55,
  },
  stepBody: {
    margin: 0,
    color: "#f4dfcf",
    fontSize: 17,
    lineHeight: 1.65,
  },
  stepBodyMuted: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 15,
    lineHeight: 1.6,
  },
  stepSubline: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 14,
    lineHeight: 1.55,
  },
  bulletList: {
    margin: "4px 0 0",
    paddingLeft: 20,
    color: "#f4dfcf",
    fontSize: 15,
    lineHeight: 1.65,
  },
  bulletItem: { marginBottom: 6 },
  signInRow: {
    marginTop: 8,
    display: "grid",
    gap: 8,
  },
  signInPrompt: {
    fontSize: 13,
    color: "#d9c3b3",
  },
  signInButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  signInBtn: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 13,
  },
  pillarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },
  pillarCard: {
    border: "1px solid #3d2f28",
    borderRadius: 12,
    padding: 10,
    background: "rgba(255,255,255,0.02)",
  },
  pillarLabel: {
    margin: "0 0 4px",
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#f0c29e",
    fontWeight: 700,
  },
  pillarText: {
    margin: 0,
    fontSize: 13,
    color: "#d9c3b3",
    lineHeight: 1.5,
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 420,
    fontSize: 12,
  },
  th: {
    textAlign: "left",
    color: "#f0c29e",
    borderBottom: "1px solid rgba(232, 220, 208, 0.22)",
    padding: "8px 8px",
  },
  td: {
    color: "#d9c3b3",
    borderBottom: "1px solid rgba(232, 220, 208, 0.1)",
    padding: "8px 8px",
    verticalAlign: "top",
    lineHeight: 1.45,
  },
  footerEcho: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "rgba(217, 194, 180, 0.65)",
    lineHeight: 1.45,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
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
    justifyContent: "flex-end",
    flex: 1,
  },
  dualStack: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: "100%",
    maxWidth: 360,
    marginLeft: "auto",
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
