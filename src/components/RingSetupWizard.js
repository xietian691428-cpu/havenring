import { useCallback, useEffect, useMemo, useState } from "react";
import {
  readNfcScanFull,
  readRingTextRecord,
  writeFixedEntryUrlToRing,
} from "../services/nfcRingService";
import {
  addBoundRing,
  canAddAnotherRing,
  computeRingUidKey,
  RING_COLOR_OPTIONS,
  RING_ICON_OPTIONS,
  upsertBoundRingByUidKey,
} from "../services/ringRegistryService";
import {
  getSecuritySummary,
  initializeSecurity,
  verifyAndTrustCurrentDevice,
} from "../services/deviceTrustService";
import { RING_SETUP_CONTENT } from "../content/ringSetupContent";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeNfcUidInput } from "@/lib/nfc-uid-browser";
import { getInstallGuideCopy } from "../content/installGuideContent";
import { detectPlatform } from "../hooks/usePlatform";
import { getPlatformGuidance } from "../utils/platformGuidance";
import { trackFirstRunEvent } from "../services/firstRunTelemetryService";

function privacyPolicyHref() {
  if (typeof window === "undefined") return "/privacy-policy";
  const override = process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL;
  if (override && /^https?:\/\//i.test(override)) return override;
  return `${window.location.origin}/privacy-policy`;
}

export const RING_SETUP_DISMISSED_KEY = "haven.ring.setup.dismissed.v1";
const INSTALL_CONFIRM_SUPPRESS_KEY = "haven.install.confirm.suppress.v1";
const PENDING_RING_SCAN_KEY = "haven.ring.setup.pending_scan.v1";

function isIosLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua);
}

function hasWebNfc() {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const standaloneDisplay = window.matchMedia?.("(display-mode: standalone)")
    ?.matches;
  const iosStandalone = window.navigator?.standalone === true;
  return Boolean(standaloneDisplay || iosStandalone);
}

function uidFromAnyUrlText(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  const direct = normalizeNfcUidInput(text);
  if (direct) return direct;
  try {
    const url = new URL(text, typeof window !== "undefined" ? window.location.origin : "https://example.com");
    const candidates = [
      url.searchParams.get("nfc_uid"),
      url.searchParams.get("uid"),
      url.searchParams.get("ring_uid"),
      url.searchParams.get("ring"),
      url.searchParams.get("tag"),
      decodeURIComponent(url.hash || "").replace(/^#/, ""),
      url.pathname.split("/").filter(Boolean).pop() || "",
    ];
    for (const c of candidates) {
      const n = normalizeNfcUidInput(c || "");
      if (n) return n;
    }
  } catch {
    // ignore malformed URL text
  }
  return "";
}

/**
 * Phase 1 setup: named rings, UID/fingerprint, secondary verification, success + backup nudge.
 */
export function RingSetupWizard({
  open,
  onClose,
  onFinished,
  onTestSeal,
  locale = "en",
  onOpenSettings,
}) {
  useEffect(() => {
    const id = "haven-ring-setup-keyframes";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@keyframes havenRingPop{0%{transform:scale(0.65);opacity:0.35}55%{transform:scale(1.08);opacity:1}100%{transform:scale(1);opacity:1}}@keyframes nfcPulseA{0%{transform:scale(0.85);opacity:0.5}100%{transform:scale(1.6);opacity:0}}@keyframes nfcPulseB{0%{transform:scale(0.9);opacity:0.35}100%{transform:scale(2.1);opacity:0}}`;
    document.head.appendChild(style);
  }, []);

  const t = useMemo(
    () => RING_SETUP_CONTENT[locale] || RING_SETUP_CONTENT.en,
    [locale]
  );
  const platformGuidance = useMemo(
    () => getPlatformGuidance(isIosLike() ? "ios" : hasWebNfc() ? "android" : "other"),
    []
  );
  const { canInstall, installStatus, install } = usePwaInstall({
    installPreparingTimeout: t.installPreparingTimeout,
    installReadyAfterDelay: t.installReadyAfterDelay,
  });
  const [step, setStep] = useState("intro");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanPayload, setScanPayload] = useState(null);
  const [password, setPassword] = useState("");
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [setupRecoveryCode, setSetupRecoveryCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [bindError, setBindError] = useState("");
  const [stepNote, setStepNote] = useState("");
  const [installConsentOpen, setInstallConsentOpen] = useState(false);
  const [suppressInstallConfirm, setSuppressInstallConfirm] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(INSTALL_CONFIRM_SUPPRESS_KEY) === "1";
  });
  const [label, setLabel] = useState("");
  const [colorKey, setColorKey] = useState(RING_COLOR_OPTIONS[0].key);
  const [icon, setIcon] = useState(RING_ICON_OPTIONS[0]);
  const [showInstallSafetyDetails, setShowInstallSafetyDetails] = useState(false);
  const [iosInstallGuideOpen, setIosInstallGuideOpen] = useState(false);
  const [linkProvisionStatus, setLinkProvisionStatus] = useState("");
  const [rewriteUrl, setRewriteUrl] = useState("https://havenring.me/start");
  const [rewriteBusy, setRewriteBusy] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const openedUidFromUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return uidFromAnyUrlText(window.location.href);
  }, []);
  const installStateLine = canInstall ? t.installStateReady : t.installStateManual;
  const ringLinkStateLine = openedUidFromUrl
    ? t.ringLinkDetected
    : t.ringLinkNotDetected;

  const resetFormState = useCallback(() => {
    setScanPayload(null);
    setPassword("");
    setSetupPassword("");
    setSetupConfirm("");
    setSetupBusy(false);
    setSetupError("");
    setSetupRecoveryCode("");
    setRecoveryCode("");
    setVerifyError("");
    setBindError("");
    setStepNote("");
    setInstallConsentOpen(false);
    setLabel("");
    setColorKey(RING_COLOR_OPTIONS[0].key);
    setIcon(RING_ICON_OPTIONS[0]);
    setScanBusy(false);
    setShowInstallSafetyDetails(false);
    setIosInstallGuideOpen(false);
    setLinkProvisionStatus("");
    setRewriteUrl("https://havenring.me/start");
    setRewriteBusy(false);
    setRewriteError("");
  }, []);

  const persistPendingScan = useCallback((payload) => {
    if (typeof window === "undefined" || !payload) return;
    try {
      window.localStorage.setItem(PENDING_RING_SCAN_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage failures
    }
  }, []);

  const clearPendingScan = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(PENDING_RING_SCAN_KEY);
    } catch {
      // ignore storage failures
    }
  }, []);

  const resumeAfterSecuritySetup = useCallback(() => {
    const security = getSecuritySummary();
    if (!security.initialized) {
      setStepNote(t.needSecurityStillMissing || "Device protection is still not ready.");
      return false;
    }
    clearPendingScan();
    setStepNote("");
    setStep("verify");
    return true;
  }, [clearPendingScan, t.needSecurityStillMissing]);

  useEffect(() => {
    if (!open || step !== "intro" || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PENDING_RING_SCAN_KEY);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (!payload || (!payload.serialNumber && !payload.text)) return;
      setScanPayload(payload);
      const security = getSecuritySummary();
      if (security.initialized) {
        clearPendingScan();
        setStep("verify");
      } else {
        setStep("blocked_security");
      }
    } catch {
      // ignore malformed pending payload
    }
  }, [open, step, clearPendingScan]);

  function dismissWizard() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RING_SETUP_DISMISSED_KEY, "1");
    }
    onClose?.();
  }

  async function runScan() {
    setScanBusy(true);
    setBindError("");
    try {
      const data = await readNfcScanFull();
      setScanPayload(data);
      const security = getSecuritySummary();
      if (!security.initialized) {
        persistPendingScan(data);
        setStep("blocked_security");
        return;
      }
      setStep("verify");
    } catch {
      setBindError(t.readError);
    } finally {
      setScanBusy(false);
    }
  }

  async function handleVerify() {
    setVerifyBusy(true);
    setVerifyError("");
    try {
      await verifyAndTrustCurrentDevice({
        password,
        recoveryCode,
      });
      setStep("name");
    } catch {
      setVerifyError(t.verifyError);
    } finally {
      setVerifyBusy(false);
    }
  }

  function normalizedUidFromScan(payload) {
    if (!payload) return "";
    const raw = payload.serialNumber || payload.text || "";
    let n = normalizeNfcUidInput(raw);
    if (!n && payload.text) {
      n = normalizeNfcUidInput(payload.text);
    }
    return n;
  }

  function continueWithOpenedRingLink() {
    const normalized = uidFromAnyUrlText(openedUidFromUrl);
    if (!normalized) {
      setBindError(t.readError);
      return;
    }
    setBindError("");
    setScanPayload({
      serialNumber: normalized,
      text: normalized,
    });
    const security = getSecuritySummary();
    if (!security.initialized) {
      persistPendingScan({
        serialNumber: normalized,
        text: normalized,
      });
      setStep("blocked_security");
      return;
    }
    setStep("verify");
  }

  async function handleSaveRing() {
    setVerifyBusy(true);
    setBindError("");
    try {
      const normalizedUid = normalizedUidFromScan(scanPayload);
      if (!normalizedUid) {
        setBindError(t.readError);
        return;
      }

      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setBindError(t.cloudSignInRequired);
        return;
      }
      const u = session.user;
      const isAnon =
        u.app_metadata?.provider === "anonymous" || u.is_anonymous === true;
      if (isAnon) {
        setBindError(t.cloudAccountRequired);
        return;
      }

      const res = await fetch("/api/nfc/bind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          "X-Haven-Secondary-Verified": "1",
        },
        body: JSON.stringify({
          nfc_uid: normalizedUid,
          nickname: (label.trim() || "Ring").trim(),
          privacy_acknowledged: true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          typeof json.error === "string" && json.error ? json.error : "";
        if (res.status === 409 && normalizedUid) {
          // Cloud already has this ring; repair/align local registry to keep silent login stable.
          upsertBoundRingByUidKey(computeRingUidKey(normalizedUid), {
            label: label.trim() || "Ring",
          });
          setStep("success");
          return;
        }
        setBindError(
          errMsg || t.cloudBindFailed
        );
        return;
      }

      try {
        await addBoundRing({
          serialNumber: scanPayload?.serialNumber,
          fallbackText: scanPayload?.text,
          label: label.trim() || "Ring",
          colorKey,
          icon,
          cloudRingId: json?.ring?.id || null,
          cloudBoundAt: json?.ring?.bound_at || null,
          cloudLastUsedAt: json?.ring?.last_used_at || null,
        });
      } catch (err) {
        if (err?.code !== "duplicate_ring") throw err;
        upsertBoundRingByUidKey(computeRingUidKey(normalizedUid), {
          label: label.trim() || "Ring",
          colorKey,
          icon,
          cloudRingId: json?.ring?.id || null,
          cloudBoundAt: json?.ring?.bound_at || null,
          cloudLastUsedAt: json?.ring?.last_used_at || null,
        });
      }
      setLinkProvisionStatus(
        isIosLike() ? t.factoryStartLinkReadyIos : t.factoryStartLinkReadyAndroid
      );
      void trackFirstRunEvent("ring_start_link_factory_ready", {
        locale,
        metadata: { source: "ring_setup_bind", strategy: "factory_prewritten_url" },
      });
      setStep("success");
    } catch (e) {
      if (e?.code === "duplicate_ring") {
        setBindError(t.duplicateError);
      } else if (e?.code === "ring_limit") {
        setStep("limit");
      } else {
        setBindError(t.readError);
      }
    } finally {
      setVerifyBusy(false);
    }
  }

  async function setupSecurityAndContinue() {
    const pwd = String(setupPassword || "");
    const confirm = String(setupConfirm || "");
    if (pwd.trim().length < 6) {
      setSetupError(t.setupPasswordTooShort || "Password must be at least 6 characters.");
      return;
    }
    if (pwd !== confirm) {
      setSetupError(t.setupPasswordMismatch || "Passwords do not match.");
      return;
    }
    setSetupBusy(true);
    setSetupError("");
    try {
      const { recoveryCode: code } = await initializeSecurity(pwd);
      setSetupRecoveryCode(code || "");
      setPassword(pwd);
      setStepNote(t.setupSecurityDone || "Device protection is ready. Continuing binding...");
      setStep("name");
    } catch {
      setSetupError(t.setupSecurityFailed || "Could not set device protection. Please try again.");
    } finally {
      setSetupBusy(false);
    }
  }

  async function installPwaNow() {
    setStepNote("");
    if (canInstall) {
      try {
        await install();
        setStepNote(t.installSuccessNotice || installStatus || t.installDoneHint);
        return;
      } catch {
        setStepNote(t.copyLinkFailed);
        return;
      }
    }
    openIosInstallGuide();
  }

  async function rewriteRingLinkNow() {
    const candidate = String(rewriteUrl || "").trim();
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      setRewriteError(t.rewriteInvalidUrl);
      return;
    }
    if (parsed.protocol !== "https:") {
      setRewriteError(t.rewriteInvalidUrl);
      return;
    }
    setRewriteBusy(true);
    setRewriteError("");
    setStepNote("");
    try {
      const finalUrl = parsed.toString();
      await writeFixedEntryUrlToRing(finalUrl);
      setStepNote(t.rewriteDone);
      const readBack = await readRingTextRecord();
      const readBackText = String(readBack?.text || "").trim();
      if (readBackText && readBackText === finalUrl) {
        setStepNote(t.rewriteVerified || t.rewriteDone);
      } else {
        setRewriteError(t.rewriteVerifyFailed || t.rewriteFailed);
      }
      void trackFirstRunEvent("ring_start_link_rewritten_success", {
        locale,
        metadata: {
          source: "ring_setup_rewrite",
          platform: platformGuidance.platform,
          verified: readBackText === finalUrl,
        },
      });
    } catch {
      setRewriteError(t.rewriteFailed);
      void trackFirstRunEvent("ring_start_link_rewritten_failed", {
        locale,
        metadata: { source: "ring_setup_rewrite", platform: platformGuidance.platform },
      });
    } finally {
      setRewriteBusy(false);
    }
  }

  function onInstallEntryClick() {
    if (suppressInstallConfirm) {
      void installPwaNow();
      return;
    }
    setInstallConsentOpen(true);
  }

  function openIosInstallGuide() {
    setIosInstallGuideOpen(true);
  }

  function closeIosInstallGuide() {
    setIosInstallGuideOpen(false);
  }

  async function copySiteLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setStepNote(t.copyLinkDone);
    } catch {
      setStepNote(t.copyLinkFailed);
    }
  }

  if (!open) return null;

  const atLimit = !canAddAnotherRing();

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="ring-setup-title">
      <section style={styles.modal}>
        {step === "intro" ? (
          <>
            <p style={styles.kicker}>{t.kicker}</p>
            <h2 id="ring-setup-title" style={styles.title}>
              {t.title}
            </h2>
            <p style={styles.body}>{t.introBody}</p>
            <p style={styles.hint}>{platformGuidance.ringClaimLine}</p>
            <p style={styles.privacyFine}>
              {t.privacyBindNotice}{" "}
              <a href={privacyPolicyHref()} target="_blank" rel="noreferrer" style={styles.privacyLink}>
                {t.privacyPolicyLink}
              </a>
            </p>
            {atLimit ? (
              <>
                <p style={styles.warn}>{t.limitBody}</p>
                <button type="button" onClick={onClose} style={styles.primaryBtn}>
                  {t.limitCta}
                </button>
              </>
            ) : (
              <div style={styles.actions}>
                {!isStandalonePwa() ? (
                  <button
                    type="button"
                    onClick={onInstallEntryClick}
                    style={styles.secondaryBtn}
                  >
                    {t.installNowCta}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    if (!hasWebNfc()) {
                      setStep(isIosLike() ? "blocked_ios" : "blocked_no_nfc");
                      return;
                    }
                    setStep("scan");
                  }}
                  style={styles.primaryBtn}
                >
                  {t.ctaAddRing}
                </button>
                <button type="button" onClick={dismissWizard} style={styles.ghostBtn}>
                  {t.ctaSkip}
                </button>
              </div>
            )}
            {stepNote ? <p style={styles.hint}>{stepNote}</p> : null}
            <div style={styles.statusBox}>
              <p style={styles.statusLine}>
                {t.installOptionalLater ||
                  "Install is optional now. You can do it later in Settings."}
              </p>
            </div>
            {installConsentOpen ? (
              <div style={styles.noticeBox}>
                <p style={styles.noticeTitle}>{t.installConsentTitle}</p>
                <p style={styles.hint}>{t.installConsentBody}</p>
                <p style={styles.hint}>{t.installConsentRevoke}</p>
                <label style={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={suppressInstallConfirm}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setSuppressInstallConfirm(next);
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(
                          INSTALL_CONFIRM_SUPPRESS_KEY,
                          next ? "1" : "0"
                        );
                      }
                    }}
                  />
                  <span>{t.installSuppressConfirmLabel}</span>
                </label>
                <div style={styles.actions}>
                  <button
                    type="button"
                    onClick={() => {
                      setInstallConsentOpen(false);
                      void installPwaNow();
                    }}
                    style={styles.primaryBtn}
                  >
                    {t.installConsentConfirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallConsentOpen(false)}
                    style={styles.ghostBtn}
                  >
                    {t.installConsentCancel}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {step === "blocked_install_recommended" ? (
          <>
            <p style={styles.kicker}>{t.kicker}</p>
            {(() => {
              const installCopy = getInstallGuideCopy(detectPlatform());
              return (
                <>
            <h2 style={styles.title}>{installCopy.pageTitle}</h2>
            <p style={styles.body}>{installCopy.lead}</p>
            <p style={styles.hint}>{installCopy.secondary}</p>
                </>
              );
            })()}
            <div style={styles.noticeBox}>
              {(() => {
                const installCopy = getInstallGuideCopy(detectPlatform());
                return (
                  <>
              <p style={styles.noticeTitle}>{installCopy.safetyTitle}</p>
              <p style={styles.hint}>{installCopy.safetyBrief}</p>
              <button
                type="button"
                onClick={() => setShowInstallSafetyDetails((prev) => !prev)}
                style={styles.inlineLinkBtn}
              >
                {showInstallSafetyDetails
                  ? t.iosInstallSafetyCollapse
                  : t.iosInstallSafetyExpand}
              </button>
              {showInstallSafetyDetails ? (
                <>
                  {installCopy.safetyDetails.map((line) => (
                    <p key={line} style={styles.hint}>{line}</p>
                  ))}
                  <p style={styles.hint}>{installCopy.safetyPrivacy}</p>
                </>
              ) : null}
                  </>
                );
              })()}
            </div>
            <div style={styles.statusBox}>
              <p style={styles.statusLine}>{installStateLine}</p>
              <p style={styles.statusLine}>{ringLinkStateLine}</p>
            </div>
            {iosInstallGuideOpen && detectPlatform() === "ios" ? (
              <div style={styles.noticeBox}>
                <p style={styles.noticeTitle}>{t.iosInstallGuideTitle}</p>
                <p style={styles.hint}>{t.iosInstallGuideTone}</p>
                <ol style={styles.stepList}>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep1}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep2}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep3}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep4}</li>
                </ol>
                <div style={styles.screenshotMock} aria-hidden>
                  <p style={styles.screenshotTitle}>Safari</p>
                  <p style={styles.screenshotRow}>{"Share -> Add to Home Screen"}</p>
                  <p style={styles.screenshotRow}>Haven icon appears on Home Screen</p>
                </div>
                <p style={styles.hint}>{t.iosInstallGuideScreenshotHint1}</p>
                <p style={styles.hint}>{t.iosInstallGuideScreenshotHint2}</p>
                <button type="button" onClick={closeIosInstallGuide} style={styles.ghostBtn}>
                  {t.androidOk}
                </button>
              </div>
            ) : null}
            {stepNote ? <p style={styles.hint}>{stepNote}</p> : null}
            <div style={styles.actions}>
              {detectPlatform() === "android" && canInstall ? (
                <button type="button" onClick={() => void installPwaNow()} style={styles.primaryBtn}>
                  {getInstallGuideCopy("android").installAppCta}
                </button>
              ) : null}
              {detectPlatform() === "ios" ? (
                <button type="button" onClick={openIosInstallGuide} style={styles.secondaryBtn}>
                  {t.iosInstallGuideCta}
                </button>
              ) : null}
              <a href="/setup?return=%2Fapp" style={{ ...styles.secondaryBtn, textAlign: "center", textDecoration: "none" }}>
                Open full install guide
              </a>
              <button type="button" onClick={() => void copySiteLink()} style={styles.ghostBtn}>
                {t.copyLinkCta}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hasWebNfc()) {
                    setStep(isIosLike() ? "blocked_ios" : "blocked_no_nfc");
                    return;
                  }
                  setStep("scan");
                }}
                style={styles.primaryBtn}
              >
                {getInstallGuideCopy(detectPlatform()).primaryCta}
              </button>
              <button type="button" onClick={() => setStep("intro")} style={styles.ghostBtn}>
                {t.ctaSkip}
              </button>
            </div>
          </>
        ) : null}

        {step === "blocked_ios" ? (
          <>
            <p style={styles.kicker}>{t.kicker}</p>
            <h2 style={styles.title}>{t.iosNfcTitle}</h2>
            <p style={styles.body}>{t.iosNfcBody}</p>
            <p style={styles.hint}>
              {openedUidFromUrl ? t.useOpenedRingLinkHint : t.noOpenedRingLinkHint}
            </p>
            <div style={styles.noticeBox}>
              <p style={styles.noticeTitle}>{t.iosInstallSafetyTitle}</p>
              <p style={styles.hint}>{t.iosInstallSafetyBrief}</p>
              <button
                type="button"
                onClick={() => setShowInstallSafetyDetails((prev) => !prev)}
                style={styles.inlineLinkBtn}
              >
                {showInstallSafetyDetails
                  ? t.iosInstallSafetyCollapse
                  : t.iosInstallSafetyExpand}
              </button>
              {showInstallSafetyDetails ? (
                <>
                  <p style={styles.hint}>{t.iosInstallSafetyBody}</p>
                  <p style={styles.hint}>{t.iosInstallSafetyPrivacy}</p>
                </>
              ) : null}
            </div>
            <div style={styles.statusBox}>
              <p style={styles.statusLine}>{installStateLine}</p>
              <p style={styles.statusLine}>{ringLinkStateLine}</p>
            </div>
            {iosInstallGuideOpen ? (
              <div style={styles.noticeBox}>
                <p style={styles.noticeTitle}>{t.iosInstallGuideTitle}</p>
                <p style={styles.hint}>{t.iosInstallGuideTone}</p>
                <ol style={styles.stepList}>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep1}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep2}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep3}</li>
                  <li style={styles.stepItem}>{t.iosInstallGuideStep4}</li>
                </ol>
                <div style={styles.screenshotMock} aria-hidden>
                  <p style={styles.screenshotTitle}>Safari</p>
                  <p style={styles.screenshotRow}>{"Share -> Add to Home Screen"}</p>
                  <p style={styles.screenshotRow}>Haven icon appears on Home Screen</p>
                </div>
                <p style={styles.hint}>{t.iosInstallGuideScreenshotHint1}</p>
                <p style={styles.hint}>{t.iosInstallGuideScreenshotHint2}</p>
                <button type="button" onClick={closeIosInstallGuide} style={styles.ghostBtn}>
                  {t.androidOk}
                </button>
              </div>
            ) : null}
            {stepNote ? <p style={styles.hint}>{stepNote}</p> : null}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={continueWithOpenedRingLink}
                style={styles.primaryBtn}
              >
                {t.useOpenedRingLinkCta}
              </button>
              {canInstall ? (
                <button type="button" onClick={() => void installPwaNow()} style={styles.primaryBtn}>
                  {t.installNowCta}
                </button>
              ) : null}
              <button type="button" onClick={openIosInstallGuide} style={styles.secondaryBtn}>
                {t.iosInstallGuideCta}
              </button>
              <button type="button" onClick={() => void copySiteLink()} style={styles.ghostBtn}>
                {t.copyLinkCta}
              </button>
              <button type="button" onClick={() => setStep("intro")} style={styles.secondaryBtn}>
                {t.androidOk}
              </button>
            </div>
          </>
        ) : null}

        {step === "blocked_no_nfc" ? (
          <>
            <h2 style={styles.title}>{t.noNfcTitle}</h2>
            <p style={styles.body}>{t.noNfcBody}</p>
            <button type="button" onClick={() => setStep("intro")} style={styles.secondaryBtn}>
              {t.androidOk}
            </button>
          </>
        ) : null}

        {step === "scan" ? (
          <>
            <div style={styles.scanImmersive}>
              <div style={styles.pulseStage} aria-hidden>
                <span style={styles.pulseDisk} />
                <span style={{ ...styles.pulseDisk, ...styles.pulseDiskB }} />
                <span style={styles.phoneGlyph}>📱</span>
              </div>
              <h2 style={{ ...styles.title, textAlign: "center" }}>{t.scanTitle}</h2>
              <p style={{ ...styles.body, textAlign: "center" }}>{t.scanBody}</p>
            </div>
            <div style={styles.statusBox} role="note" aria-live="polite">
              <p style={styles.noticeTitle}>{t.scanOrderTitle || "Order"}</p>
              <p style={styles.statusLine}>{t.scanOrderStep1 || "1) Tap the button below."}</p>
              <p style={styles.statusLine}>
                {t.scanOrderStep2 || "2) Then touch your ring to the phone."}
              </p>
            </div>
            {bindError ? <p style={styles.error}>{bindError}</p> : null}
            {!scanBusy ? (
              <button type="button" onClick={() => void runScan()} style={styles.primaryBtn}>
                {t.scanCta}
              </button>
            ) : (
              <div style={styles.statusBox} role="status" aria-live="polite">
                <p style={styles.noticeTitle}>{t.statusBindingTitle}</p>
                <p style={styles.statusLine}>{t.scanWorking || t.statusBindingScanning}</p>
              </div>
            )}
            <button type="button" onClick={() => setStep("intro")} style={styles.ghostBtn}>
              {t.ctaSkip}
            </button>
          </>
        ) : null}

        {step === "blocked_security" ? (
          <>
            <h2 style={styles.title}>{t.needSecurityTitle}</h2>
            <p style={styles.body}>{t.needSecurityBody}</p>
            <p style={styles.hint}>
              {t.needSecurityResumeHint ||
                "After setting your device password, come back here and tap Continue — no need to scan again."}
            </p>
            <div style={styles.stack}>
              <label style={styles.label}>
                {t.setupPasswordLabel || "Set device password"}
                <input
                  type="password"
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  style={styles.input}
                  placeholder={t.setupPasswordPlaceholder || "At least 6 characters"}
                  autoComplete="new-password"
                />
              </label>
              <label style={styles.label}>
                {t.setupPasswordConfirmLabel || "Confirm password"}
                <input
                  type="password"
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  style={styles.input}
                  placeholder={t.setupPasswordConfirmPlaceholder || "Type again"}
                  autoComplete="new-password"
                />
              </label>
              {setupError ? <p style={styles.error}>{setupError}</p> : null}
              <button
                type="button"
                onClick={() => void setupSecurityAndContinue()}
                disabled={setupBusy}
                style={styles.primaryBtn}
              >
                {setupBusy
                  ? t.setupSecurityWorking || "Setting up..."
                  : t.setupSecurityCta || "Set password & continue"}
              </button>
              {setupRecoveryCode ? (
                <p style={styles.hint}>
                  {(t.setupRecoveryHint || "Recovery code:") + " "}
                  <strong>{setupRecoveryCode}</strong>
                </p>
              ) : null}
            </div>
            {stepNote ? <p style={styles.statusLine}>{stepNote}</p> : null}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  persistPendingScan(scanPayload);
                  onOpenSettings?.();
                  onClose?.();
                }}
                style={styles.primaryBtn}
              >
                {t.goSettings}
              </button>
              <button
                type="button"
                onClick={() => {
                  void resumeAfterSecuritySetup();
                }}
                style={styles.secondaryBtn}
              >
                {t.continueAfterSecurity || "I set it, continue"}
              </button>
              <button type="button" onClick={() => setStep("intro")} style={styles.ghostBtn}>
                {t.androidOk}
              </button>
            </div>
          </>
        ) : null}

        {step === "verify" ? (
          <>
            <h2 style={styles.title}>{t.verifyTitle}</h2>
            <p style={styles.body}>{t.verifyBody}</p>
            <div style={styles.statusBox} role="status">
              <p style={styles.noticeTitle}>{t.statusBindingTitle}</p>
              <p style={styles.statusLine}>{t.statusBindingDetected}</p>
            </div>
            <input
              type="password"
              placeholder={t.verifyPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              autoComplete="current-password"
            />
            <input
              type="text"
              placeholder={t.verifyRecovery}
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value)}
              style={styles.input}
            />
            {verifyError ? <p style={styles.error}>{verifyError}</p> : null}
            <button
              type="button"
              disabled={verifyBusy}
              onClick={() => void handleVerify()}
              style={styles.primaryBtn}
            >
              {verifyBusy ? t.verifyWorking : t.verifyCta}
            </button>
            <button type="button" onClick={() => setStep("scan")} style={styles.ghostBtn}>
              {t.scanRetry}
            </button>
          </>
        ) : null}

        {step === "name" ? (
          <>
            <h2 style={styles.title}>{t.nameTitle}</h2>
            <p style={styles.body}>{t.nameBody}</p>
            <div style={styles.statusBox} role="status">
              <p style={styles.noticeTitle}>{t.statusBindingTitle}</p>
              <p style={styles.statusLine}>{t.statusBindingDetected}</p>
            </div>
            <input
              type="text"
              placeholder={t.namePlaceholder}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={styles.input}
            />
            <p style={styles.fieldLabel}>{t.colorLabel}</p>
            <div style={styles.colorRow}>
              {RING_COLOR_OPTIONS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={colorKey === c.key}
                  onClick={() => setColorKey(c.key)}
                  style={{
                    ...styles.colorDot,
                    background: c.hex,
                    outline: colorKey === c.key ? "2px solid #f8efe7" : "none",
                  }}
                />
              ))}
            </div>
            <p style={styles.fieldLabel}>{t.iconLabel}</p>
            <div style={styles.iconRow}>
              {RING_ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  aria-pressed={icon === ic}
                  onClick={() => setIcon(ic)}
                  style={{
                    ...styles.iconBtn,
                    borderColor: icon === ic ? "#f0c29e" : "#3d2f28",
                  }}
                >
                  {ic}
                </button>
              ))}
            </div>
            {bindError ? <p style={styles.error}>{bindError}</p> : null}
            {bindError ? (
              <button
                type="button"
                onClick={() => {
                  setBindError("");
                  resetFormState();
                  setStep("scan");
                }}
                style={styles.secondaryBtn}
              >
                {t.scanRetry}
              </button>
            ) : null}
            <button
              type="button"
              disabled={verifyBusy}
              onClick={() => void handleSaveRing()}
              style={styles.primaryBtn}
            >
              {verifyBusy ? t.verifyWorking : t.nameCta}
            </button>
          </>
        ) : null}

        {step === "success" ? (
          <div style={styles.successWrap}>
            <div style={styles.successBurst} aria-hidden>
              ✓
            </div>
            <h2 style={styles.title}>{t.successTitle}</h2>
            <p style={styles.body}>{t.successBody}</p>
            <p style={styles.encourage}>{t.successEncourage}</p>
            {linkProvisionStatus ? <p style={styles.hint}>{linkProvisionStatus}</p> : null}
            {platformGuidance.isAndroid && hasWebNfc() ? (
              <div style={styles.noticeBox}>
                <p style={styles.noticeTitle}>{t.rewriteTitle}</p>
                <p style={styles.hint}>{t.rewriteBody}</p>
                <input
                  type="url"
                  value={rewriteUrl}
                  onChange={(e) => setRewriteUrl(e.target.value)}
                  placeholder="https://havenring.me/start"
                  style={styles.input}
                />
                {rewriteError ? <p style={styles.error}>{rewriteError}</p> : null}
                <button
                  type="button"
                  onClick={() => void rewriteRingLinkNow()}
                  disabled={rewriteBusy}
                  style={styles.secondaryBtn}
                >
                  {rewriteBusy ? t.rewriteWorking : t.rewriteAction}
                </button>
              </div>
            ) : null}
            <div style={styles.actions}>
              {canAddAnotherRing() ? (
                <button
                  type="button"
                  onClick={() => {
                    resetFormState();
                    setStep("intro");
                  }}
                  style={styles.secondaryBtn}
                >
                  {t.addAnother}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onFinished?.({ nickname: label.trim() || "friend" });
                  onTestSeal?.();
                  onClose?.();
                }}
                style={styles.primaryBtn}
              >
                {t.testSealNow || "Test Seal Now"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onFinished?.({ nickname: label.trim() || "friend" });
                  onClose?.();
                }}
                style={styles.secondaryBtn}
              >
                {t.doneToHaven}
              </button>
            </div>
          </div>
        ) : null}

        {step === "limit" ? (
          <>
            <h2 style={styles.title}>{t.limitTitle}</h2>
            <p style={styles.body}>{t.limitBody}</p>
            <button type="button" onClick={onClose} style={styles.primaryBtn}>
              {t.limitCta}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(8, 7, 6, 0.78)",
    backdropFilter: "blur(10px)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 22,
    border: "1px solid #4b3931",
    background: "linear-gradient(180deg, #1b1512 0%, #120f0e 100%)",
    color: "#f8efe7",
    boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
    padding: 22,
    display: "grid",
    gap: 12,
    fontFamily: "Inter, system-ui, sans-serif",
  },
  kicker: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.25,
    fontWeight: 650,
  },
  body: {
    margin: 0,
    color: "#e4ccbc",
    fontSize: 16,
    lineHeight: 1.55,
  },
  encourage: {
    margin: 0,
    color: "#c8e6d0",
    fontSize: 15,
    lineHeight: 1.5,
  },
  hint: {
    margin: 0,
    fontSize: 13,
    color: "#a8988c",
  },
  noticeBox: {
    border: "1px solid #5a3b30",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(22, 18, 16, 0.8)",
    display: "grid",
    gap: 8,
  },
  noticeTitle: {
    margin: 0,
    fontSize: 14,
    color: "#f0c29e",
    fontWeight: 700,
  },
  statusBox: {
    border: "1px solid rgba(90, 59, 48, 0.6)",
    borderRadius: 12,
    padding: "8px 10px",
    background: "rgba(23, 18, 16, 0.7)",
    display: "grid",
    gap: 4,
  },
  statusLine: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#d9c3b3",
  },
  checkRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#d9c3b3",
  },
  inlineLinkBtn: {
    border: "none",
    background: "transparent",
    color: "#f0c29e",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 13,
    padding: 0,
    justifySelf: "start",
  },
  stepList: {
    margin: 0,
    paddingLeft: 18,
    color: "#d9c3b3",
    fontSize: 13,
    lineHeight: 1.5,
    display: "grid",
    gap: 4,
  },
  stepItem: {
    margin: 0,
  },
  screenshotMock: {
    border: "1px dashed rgba(240, 194, 158, 0.35)",
    borderRadius: 10,
    padding: "8px 10px",
    background: "rgba(26, 21, 18, 0.45)",
    display: "grid",
    gap: 4,
  },
  screenshotTitle: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#f0c29e",
  },
  screenshotRow: {
    margin: 0,
    color: "#d9c3b3",
    fontSize: 12,
    lineHeight: 1.4,
  },
  privacyFine: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#a8988c",
  },
  privacyLink: {
    color: "#f0c29e",
    textDecoration: "underline",
  },
  warn: {
    margin: 0,
    color: "#f0b090",
    fontSize: 15,
    lineHeight: 1.45,
  },
  error: {
    margin: 0,
    color: "#ffb4a8",
    fontSize: 14,
  },
  working: {
    margin: 0,
    color: "#f0c29e",
    fontSize: 15,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 4,
  },
  primaryBtn: {
    border: "1px solid #d9a67a",
    background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
    color: "#1b1411",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 16,
  },
  secondaryBtn: {
    border: "1px solid #5b4438",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 15,
  },
  ghostBtn: {
    border: "none",
    background: "transparent",
    color: "#d9c3b3",
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
    justifySelf: "start",
  },
  input: {
    borderRadius: 12,
    border: "1px solid #4b3931",
    background: "#171210",
    color: "#f8efe7",
    padding: "12px 14px",
    fontSize: 16,
  },
  fieldLabel: {
    margin: "4px 0 0",
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#a8988c",
  },
  colorRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
  },
  iconRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid #3d2f28",
    background: "#171210",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  },
  successWrap: {
    display: "grid",
    gap: 12,
    textAlign: "center",
  },
  successBurst: {
    width: 72,
    height: 72,
    margin: "0 auto",
    borderRadius: "50%",
    background: "linear-gradient(145deg, rgba(125,158,133,0.35), rgba(217,166,122,0.25))",
    display: "grid",
    placeItems: "center",
    fontSize: 36,
    color: "#e8f5eb",
    animation: "havenRingPop 0.75s ease-out 1",
  },
  scanImmersive: {
    display: "grid",
    gap: 12,
    padding: "8px 0 4px",
  },
  pulseStage: {
    position: "relative",
    width: 200,
    height: 200,
    margin: "0 auto",
    display: "grid",
    placeItems: "center",
  },
  pulseDisk: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: "50%",
    border: "2px solid rgba(240, 194, 158, 0.45)",
    animation: "nfcPulseA 2.2s ease-out infinite",
  },
  pulseDiskB: {
    width: 100,
    height: 100,
    borderColor: "rgba(196, 149, 106, 0.3)",
    animation: "nfcPulseB 2.2s ease-out infinite 0.4s",
  },
  phoneGlyph: {
    position: "relative",
    zIndex: 1,
    fontSize: 44,
    filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.35))",
  },
};
