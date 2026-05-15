import { useEffect, useRef, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import { FirstTimeOnboarding } from "../components/FirstTimeOnboarding";
import { PwaInstallCard } from "../components/PwaInstallCard";
import { HOME_PAGE_CONTENT } from "../content/homePageContent";
import {
  getSecuritySummary,
  grantRingAccess,
  initializeSecurity,
  verifyAndTrustCurrentDevice,
} from "../services/deviceTrustService";
import {
  isFirstMemoryCompleted,
  ONBOARDING_DONE_KEY,
  ONBOARDING_OUTCOME_KEY,
  trackFirstRunEvent,
} from "../services/firstRunTelemetryService";
/**
 * Haven Home Page
 * Warm, simple entry point focused on emotional clarity.
 */
export function HomePage({
  locale = "en",
  hasSession = false,
  onOpenTimeline,
  onCreateMemory,
  onOpenSettings,
  onOpenMemoryFromRing,
  onAfterOnboarding,
  onOpenRingSetup,
  onQuickSignIn,
  quickSignInError = "",
  loading = false,
  quickSigningIn = false,
  message = "",
  flowPrimaryUi = null,
  onFlowPrimaryAction,
  suppressSecondaryNotices = false,
}) {
  const t = HOME_PAGE_CONTENT[locale] || HOME_PAGE_CONTENT.en;
  const ringHandledRef = useRef(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [ringSignIn, setRingSignIn] = useState({
    needed: false,
    token: "",
    reason: "",
  });
  const [sealHelp, setSealHelp] = useState(false);
  const [platformSignInProvider, setPlatformSignInProvider] = useState("apple");
  const [securityMode, setSecurityMode] = useState("none");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [setupRecoveryCode, setSetupRecoveryCode] = useState("");
  const [securityBusy, setSecurityBusy] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [installedStandalone, setInstalledStandalone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setOnboardingDone(window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1");
    } catch {
      setOnboardingDone(false);
    }
  }, [hasSession, onboardingOpen]);

  useEffect(() => {
    if (ringHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const memoryId =
      params.get("memoryId") || params.get("memory") || params.get("m");
    if (!memoryId) return;
    ringHandledRef.current = true;
    onOpenMemoryFromRing?.(memoryId);
  }, [onOpenMemoryFromRing]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const ring = url.searchParams.get("ring");
    if (ring === "sealhelp") {
      setSealHelp(true);
      url.searchParams.delete("ring");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return;
    }
    if (ring !== "signin") return;
    setRingSignIn({
      needed: true,
      token: url.searchParams.get("token") || "",
      reason: url.searchParams.get("reason") || "",
    });
    const security = getSecuritySummary();
    const reason = url.searchParams.get("reason") || "";
    if (!security.initialized || reason === "device_setup_required") {
      setSecurityMode("setup");
    } else if (!security.trustedCurrentDevice || reason === "device_verification_required") {
      setSecurityMode("verify");
    } else {
      setSecurityMode("none");
    }
    url.searchParams.delete("ring");
    url.searchParams.delete("token");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkStandalone = () => {
      const displayStandalone = window.matchMedia?.(
        "(display-mode: standalone)"
      )?.matches;
      const iosStandalone = window.navigator?.standalone === true;
      setInstalledStandalone(Boolean(displayStandalone || iosStandalone));
    };
    checkStandalone();
    window.addEventListener("appinstalled", checkStandalone);
    return () => window.removeEventListener("appinstalled", checkStandalone);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");
    const isIOS =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes("macintosh") && "ontouchend" in window);
    if (isAndroid) {
      setPlatformSignInProvider("google");
      return;
    }
    if (isIOS) {
      setPlatformSignInProvider("apple");
      return;
    }
    setPlatformSignInProvider("apple");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasSession) return;
    const done = window.localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
    setIsFirstRun(!done || !isFirstMemoryCompleted());
    if (!done) setOnboardingOpen(true);
  }, [hasSession]);

  function markOnboardingDone(detail = {}) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(ONBOARDING_DONE_KEY, "1");
        if (detail.outcome === "skipped") {
          window.localStorage.setItem(ONBOARDING_OUTCOME_KEY, "skipped");
        } else if (detail.choice === "bind_ring") {
          window.localStorage.setItem(ONBOARDING_OUTCOME_KEY, "bind_ring");
        } else if (detail.choice === "face_only") {
          window.localStorage.setItem(ONBOARDING_OUTCOME_KEY, "face_only");
        } else {
          window.localStorage.setItem(ONBOARDING_OUTCOME_KEY, "completed");
        }
      } catch {
        /* ignore */
      }
    }
    setOnboardingOpen(false);
    setOnboardingDone(true);
    setIsFirstRun(!isFirstMemoryCompleted());
    onAfterOnboarding?.(detail);
  }

  async function continueAfterSecurity() {
    if (!ringSignIn.token) return;
    await grantRingAccess(ringSignIn.token);
    window.location.href = `/hub?token=${encodeURIComponent(ringSignIn.token)}`;
  }

  async function handleSetupSecurity() {
    if (password.length < 6) {
      setSecurityError(t.ringSecurityPasswordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setSecurityError(t.ringSecurityPasswordMismatch);
      return;
    }
    setSecurityBusy(true);
    setSecurityError("");
    try {
      const result = await initializeSecurity(password);
      setSetupRecoveryCode(result.recoveryCode);
      setSecurityMode("setup_done");
    } catch {
      setSecurityError(t.ringSecuritySetupFailed);
    } finally {
      setSecurityBusy(false);
    }
  }

  async function handleVerifySecurity() {
    setSecurityBusy(true);
    setSecurityError("");
    try {
      await verifyAndTrustCurrentDevice({
        password,
        recoveryCode: recoveryCodeInput,
      });
      await continueAfterSecurity();
    } catch {
      setSecurityError(t.ringSecurityVerifyFailed);
    } finally {
      setSecurityBusy(false);
    }
  }

  const showCalmHome =
    hasSession && onboardingDone && !onboardingOpen && !flowPrimaryUi?.enforceSingle;

  return (
    <>
      <main style={styles.page}>
        <section style={styles.shell}>
        <header style={styles.header}>
          <p style={styles.brand}>{t.brand}</p>
          <OnlineStatusBadge locale={locale} />
        </header>

        <div style={styles.hero}>
          <h1 style={styles.title}>{showCalmHome ? t.calmHomeTitle : t.title}</h1>
          <p style={styles.subtitle}>
            {showCalmHome ? t.calmHomeSubtitle : t.subtitle}
          </p>
        </div>

        {showCalmHome ? (
          <section style={styles.calmCard}>
            <p style={styles.calmLead}>{t.calmHomeLead}</p>
            <div style={styles.actions}>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void trackFirstRunEvent("calm_home_seal_cta", { locale });
                  onCreateMemory?.();
                }}
                style={styles.primaryButton}
              >
                {t.calmHomeSealCta}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void onOpenTimeline?.()}
                style={styles.secondaryButton}
              >
                {t.calmHomeTimelineCta}
              </button>
            </div>
            <p style={styles.privacyTrust}>{t.calmHomePrivacyLine}</p>
          </section>
        ) : null}

        {!showCalmHome ? (
        <section style={styles.howItWorksCard}>
          <p style={styles.howItWorksTitle}>{t.howTitle}</p>
          <p style={styles.howItWorksBody}>
            {t.howBody}
          </p>
        </section>
        ) : null}
        {flowPrimaryUi ? (
          <section style={styles.howItWorksCard}>
            <p style={styles.howItWorksTitle}>{flowPrimaryUi.title}</p>
            <p style={styles.howItWorksBody}>{flowPrimaryUi.body}</p>
            {flowPrimaryUi.actionLabel ? (
              <div style={styles.voiceActions}>
                <button
                  type="button"
                  onClick={() => onFlowPrimaryAction?.("primary")}
                  style={styles.secondaryButton}
                >
                  {flowPrimaryUi.actionLabel}
                </button>
                {flowPrimaryUi.secondaryActionLabel ? (
                  <button
                    type="button"
                    onClick={() =>
                      onFlowPrimaryAction?.(
                        flowPrimaryUi.secondaryActionIntent || "secondary"
                      )
                    }
                    style={styles.tertiaryButton}
                  >
                    {flowPrimaryUi.secondaryActionLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
        {!suppressSecondaryNotices && !installedStandalone ? (
          <PwaInstallCard locale={locale} />
        ) : null}
        {ringSignIn.needed && !suppressSecondaryNotices ? (
          <section style={styles.ringSignInCard}>
            <p style={styles.ringSignInTitle}>{t.ringSignInTitle}</p>
            <p style={styles.howItWorksBody}>{t.ringSignInBody}</p>
            {ringSignIn.reason === "permission_denied" ? (
              <p style={styles.feedback}>{t.ringSignInPermissionHint}</p>
            ) : null}
            <button
              type="button"
              disabled={quickSigningIn}
              onClick={() =>
                onQuickSignIn?.(platformSignInProvider, ringSignIn.token)
              }
              style={styles.primaryButton}
            >
              {quickSigningIn
                ? t.ringSignInPrimaryLoading
                : platformSignInProvider === "google"
                  ? t.ringSignInGoogle
                  : t.ringSignInApple}
            </button>
            <div style={styles.altSignInRow}>
              <button
                type="button"
                disabled={quickSigningIn || platformSignInProvider === "google"}
                onClick={() => onQuickSignIn?.("apple", ringSignIn.token)}
                style={styles.tertiaryButton}
              >
                {t.ringSignInApple}
              </button>
              <button
                type="button"
                disabled={quickSigningIn}
                onClick={() => onQuickSignIn?.("google", ringSignIn.token)}
                style={styles.tertiaryButton}
              >
                {t.ringSignInGoogle}
              </button>
            </div>
            {platformSignInProvider === "google" ? (
              <p style={styles.feedback}>{t.ringSignInAppleUnavailableHint}</p>
            ) : null}
            {securityMode === "setup" ? (
              <section style={styles.securityBox}>
                <p style={styles.ringSignInTitle}>{t.ringSecuritySetupTitle}</p>
                <input
                  type="password"
                  placeholder={t.ringSecurityPasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.inlineInput}
                />
                <input
                  type="password"
                  placeholder={t.ringSecurityConfirmPasswordPlaceholder}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.inlineInput}
                />
                <button
                  type="button"
                  disabled={securityBusy}
                  onClick={handleSetupSecurity}
                  style={styles.secondaryButton}
                >
                  {securityBusy ? t.ringSecurityWorking : t.ringSecuritySetupAction}
                </button>
                {securityError ? <p style={styles.feedback}>{securityError}</p> : null}
              </section>
            ) : null}
            {securityMode === "setup_done" ? (
              <section style={styles.securityBox}>
                <p style={styles.ringSignInTitle}>{t.ringSecurityRecoveryTitle}</p>
                <p style={styles.howItWorksBody}>{setupRecoveryCode}</p>
                <p style={styles.feedback}>{t.ringSecurityRecoveryHint}</p>
                <button
                  type="button"
                  disabled={securityBusy}
                  onClick={continueAfterSecurity}
                  style={styles.secondaryButton}
                >
                  {t.ringSecurityContinue}
                </button>
              </section>
            ) : null}
            {securityMode === "verify" ? (
              <section style={styles.securityBox}>
                <p style={styles.ringSignInTitle}>{t.ringSecurityVerifyTitle}</p>
                <p style={styles.howItWorksBody}>{t.ringSecurityVerifyBody}</p>
                <input
                  type="password"
                  placeholder={t.ringSecurityPasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.inlineInput}
                />
                <input
                  type="text"
                  placeholder={t.ringSecurityRecoveryPlaceholder}
                  value={recoveryCodeInput}
                  onChange={(e) => setRecoveryCodeInput(e.target.value)}
                  style={styles.inlineInput}
                />
                <button
                  type="button"
                  disabled={securityBusy}
                  onClick={handleVerifySecurity}
                  style={styles.secondaryButton}
                >
                  {securityBusy ? t.ringSecurityWorking : t.ringSecurityVerifyAction}
                </button>
                {securityError ? <p style={styles.feedback}>{securityError}</p> : null}
              </section>
            ) : null}
          </section>
        ) : null}
        {sealHelp && !suppressSecondaryNotices ? (
          <section style={styles.ringSignInCard}>
            <p style={styles.ringSignInTitle}>{t.sealHelpTitle}</p>
            <p style={styles.howItWorksBody}>{t.sealHelpBody}</p>
            <button
              type="button"
              onClick={onCreateMemory}
              style={styles.secondaryButton}
            >
              {t.sealHelpAction}
            </button>
          </section>
        ) : null}

          {!showCalmHome && !flowPrimaryUi?.enforceSingle ? <div style={styles.actions}>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (isFirstRun) {
                void trackFirstRunEvent("first_memory_cta_clicked", { locale });
                onCreateMemory?.();
                return;
              }
              onOpenTimeline?.();
            }}
            style={styles.primaryButton}
          >
            {loading ? t.opening : isFirstRun ? t.firstMissionPrimary : t.open}
          </button>
          {isFirstRun ? (
            <section style={styles.howItWorksCard}>
              <p style={styles.howItWorksTitle}>{t.firstMissionTitle}</p>
              <p style={styles.howItWorksBody}>{t.firstMissionBody}</p>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  void trackFirstRunEvent("ring_setup_cta_clicked", { locale });
                  onOpenRingSetup?.();
                }}
                style={styles.secondaryButton}
              >
                {t.firstMissionSecondary}
              </button>
            </section>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={onCreateMemory}
            style={styles.secondaryButton}
          >
            {t.create}
          </button>
            <button
              type="button"
              disabled={loading}
              onClick={onOpenSettings}
              style={styles.tertiaryButton}
            >
              {t.settings}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setOnboardingOpen(true)}
              style={styles.tertiaryButton}
            >
              {t.start}
            </button>
            {!isFirstRun ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => onOpenRingSetup?.()}
                style={styles.tertiaryButton}
              >
                {t.ringSetupCta}
              </button>
            ) : null}
          </div> : null}

          <p style={styles.feedback}>{message || "\u00A0"}</p>
          {quickSignInError ? <p style={styles.feedback}>{quickSignInError}</p> : null}
        </section>
      </main>
      <FirstTimeOnboarding
        open={onboardingOpen}
        locale={locale}
        onComplete={markOnboardingDone}
        onQuickSignIn={(provider) => onQuickSignIn?.(provider, "")}
      />
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    placeItems: "center",
    background: "radial-gradient(circle at top, #2a1e19 0%, #120f0e 55%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 680,
    border: "1px solid #3a2d28",
    borderRadius: 22,
    background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
    padding: 24,
    display: "grid",
    gap: 24,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.24em",
    fontSize: 12,
    color: "#d9c3b3",
  },
  hero: {
    display: "grid",
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.25,
    fontWeight: 500,
  },
  subtitle: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.7,
    maxWidth: 560,
  },
  calmCard: {
    border: "1px solid rgba(196, 149, 106, 0.35)",
    borderRadius: 16,
    background: "rgba(26, 21, 18, 0.55)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  calmLead: {
    margin: 0,
    fontSize: 17,
    color: "#f8efe7",
    lineHeight: 1.55,
    fontWeight: 600,
  },
  privacyTrust: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(217, 194, 180, 0.65)",
  },
  howItWorksCard: {
    border: "1px solid #3a2d28",
    borderRadius: 14,
    background: "#1b1512",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  howItWorksTitle: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#f0c29e",
  },
  howItWorksBody: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
    fontSize: 14,
  },
  ringSignInCard: {
    border: "1px solid #d9a67a",
    borderRadius: 14,
    background: "#1b1512",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  securityBox: {
    border: "1px solid #5a3b30",
    borderRadius: 10,
    padding: 10,
    display: "grid",
    gap: 8,
  },
  inlineInput: {
    border: "1px solid #3a2d28",
    borderRadius: 10,
    background: "#1f1816",
    color: "#f8efe7",
    padding: "10px 12px",
  },
  ringSignInTitle: {
    margin: 0,
    fontSize: 13,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#f0c29e",
  },
  altSignInRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  voiceActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actions: {
    display: "grid",
    gap: 12,
  },
  primaryButton: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    fontSize: 16,
    fontWeight: 700,
    padding: "14px 18px",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 600,
    padding: "12px 16px",
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    fontSize: 13,
    minHeight: 18,
    color: "#f2d8c5",
  },
  tertiaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#d9c3b3",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 16px",
    cursor: "pointer",
  },
};
