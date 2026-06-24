import { useEffect, useMemo, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import {
  clearAllMemories,
  getAllMemories,
} from "../services/localStorageService";
import {
  backupToCloud,
  CLOUD_STORAGE_FULL_MESSAGE,
  getCloudBackupSettings,
  restoreFromCloud,
  restoreFromCloudDeep,
  restoreCloudBackupsQuietly,
  setCloudBackupEnabled,
  signOutCloudBackup,
  syncCloudBackupFromAuthSession,
} from "../services/cloudBackupService";
import { SETTINGS_CONTENT } from "../content/settingsContent";
import {
  fetchSecondaryVerificationToken,
  getKeepSignedInPreference,
  getSecuritySummary,
  revokeTrustedDevice,
  setKeepSignedInPreference,
  verifyAndTrustCurrentDevice,
} from "../services/deviceTrustService";
import {
  isTemporaryDeviceModeEnabled,
  setTemporaryDeviceModeEnabled,
  wipeTemporaryDevice,
} from "../services/temporaryDeviceService";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { canonicalAuthOriginFromLocation } from "../../lib/auth-redirect";
import { requestStoragePersistenceFromUserGesture } from "../../lib/requestStoragePersistence";
import { sanctuaryTheme } from "../theme/sanctuaryTheme";
import { APP_PAGE_PADDING } from "../theme/pageLayout";
import { havenCopy } from "../content/havenCopy";
import { useFeedbackPrefs } from "../hooks/useFeedbackPrefs";
import { canUseFeature } from "../features/subscription";
import { getFreeEntitlements } from "../services/subscriptionService";
import { markOpenPartnerInviteOnRings } from "@/lib/partner-invite-ui";

/**
 * Settings Page
 * - Local data management
 * - Optional cloud backup switch
 * - Privacy-first messaging
 */
export function SettingsPage({
  onBack,
  onOpenHelp,
  onOpenPricing,
  onOpenRings,
  onLocalDataCleared,
  onDeepSync,
  locale = "en",
  userEntitlements = getFreeEntitlements(),
}) {
  const localeCopy = SETTINGS_CONTENT[locale] || SETTINGS_CONTENT.en;
  const ex = havenCopy.settingsExport;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const [storageText, setStorageText] = useState(localeCopy.loadingStats);
  const [cloud, setCloud] = useState(() => getCloudBackupSettings());
  const [security, setSecurity] = useState(() => getSecuritySummary());
  const [keepSignedIn, setKeepSignedIn] = useState(() =>
    getKeepSignedInPreference()
  );
  const [temporaryMode, setTemporaryMode] = useState(() =>
    isTemporaryDeviceModeEnabled()
  );
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyRecoveryCode, setVerifyRecoveryCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [exportFormat, setExportFormat] = useState("full");
  const [exportPickerOpen, setExportPickerOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [pendingProtectedAction, setPendingProtectedAction] = useState("");
  const { soundEnabled, hapticEnabled, updateFeedbackPrefs } = useFeedbackPrefs();

  const canUseCloudBackup = canUseFeature(userEntitlements, "cloud_backup");

  const [havenPlus, setHavenPlus] = useState(null);

  const cloudStateText = useMemo(() => {
    if (!cloud.enabled) return localeCopy.cloudOff;
    if (!canUseCloudBackup) return localeCopy.cloudRequiresPlus;
    if (!cloud.user) return localeCopy.cloudEnabledNoSignIn;
    return localeCopy.cloudEnabledSignedIn;
  }, [canUseCloudBackup, cloud.enabled, cloud.user, localeCopy]);

  useEffect(() => {
    void (async () => {
      await refreshLocalStats();
      const synced = await syncCloudBackupFromAuthSession();
      setCloud(synced);
      if (synced.enabled && synced.user?.id) {
        void restoreCloudBackupsQuietly();
      }
      try {
        const sb = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await sb.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/haven/plus-billing", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (body?.havenPlus) setHavenPlus(body.havenPlus);
      } catch {
        /* optional */
      }
    })();
  }, []);

  async function refreshLocalStats() {
    setLoading(true);
    try {
      const memories = await getAllMemories();
      setLocalCount(memories.length);
      const estimate = await estimateStorage(localeCopy.storageUnavailable);
      setStorageText(estimate);
    } catch {
      setStatus(localeCopy.loadStatsFailed);
    } finally {
      setLoading(false);
    }
  }

  function openVerificationFor(actionName) {
    setPendingProtectedAction(actionName);
    setVerifyPassword("");
    setVerifyRecoveryCode("");
    setVerifyError("");
    setVerifyOpen(true);
  }

  async function handleExportBackup() {
    setExportPickerOpen(true);
  }

  function confirmExportFormatAndVerify() {
    setExportPickerOpen(false);
    openVerificationFor("export_backup");
  }

  async function runExportBackup() {
    setBusy(true);
    setExportProgress(8);
    setStatus(ex.preparingDetail);
    const steps = [20, 45, 70, 90];
    let i = 0;
    const tick = window.setInterval(() => {
      if (i < steps.length) {
        setExportProgress(steps[i]);
        i += 1;
      }
    }, 140);
    try {
      const memories = await getAllMemories();
      let rows = memories;
      if (exportFormat === "lite") {
        rows = memories.map((m) => ({
          ...m,
          photo: null,
          voice: null,
          attachments: [],
        }));
      }
      const backup = {
        exportedAt: Date.now(),
        type: "haven-local-backup-v1",
        format: exportFormat === "lite" ? "lite" : "full",
        memories: rows,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `haven-backup-${exportFormat}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportProgress(100);
      setStatus(`${ex.exportSuccessToast} ${ex.exportAftercare}`);
      requestStoragePersistenceFromUserGesture();
    } catch {
      setStatus(localeCopy.exportFailed);
    } finally {
      window.clearInterval(tick);
      setBusy(false);
      window.setTimeout(() => setExportProgress(0), 800);
    }
  }

  async function handleClearAll() {
    const confirmed = window.confirm(localeCopy.confirmClear);
    if (!confirmed) return;

    openVerificationFor("clear_all");
  }

  async function runClearAll() {
    setBusy(true);
    setStatus(localeCopy.clearing);
    try {
      await clearAllMemories();
      await refreshLocalStats();
      await onLocalDataCleared?.();
      setStatus(localeCopy.clearDone);
    } catch {
      setStatus(localeCopy.clearFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetMyBilling() {
    if (!havenPlus?.havenId) return;
    setBusy(true);
    setStatus("");
    try {
      const sb = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await sb.auth.getSession();
      const userId = session?.user?.id;
      if (!session?.access_token || !userId) return;
      const res = await fetch("/api/haven/plus-billing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          haven_id: havenPlus.havenId,
          billing_user_id: userId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "billing_update_failed");
      setHavenPlus(body.havenPlus || havenPlus);
      setStatus(localeCopy.cloudBillingYou);
    } catch {
      setStatus(localeCopy.signInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCloudBackup(enabled) {
    if (enabled) {
      const confirmed = window.confirm(localeCopy.confirmEnableCloud);
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(localeCopy.confirmDisableCloud);
      if (!confirmed) return;
    }

    const next = setCloudBackupEnabled(enabled);
    setCloud(next);
    setStatus(
      enabled ? localeCopy.cloudEnabledStatus : localeCopy.cloudDisabledStatus
    );
  }

  async function handleSignInApple() {
    const confirmed = window.confirm(localeCopy.confirmSignInApple);
    if (!confirmed) return;
    setBusy(true);
    setStatus(localeCopy.signingIn);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const next = await syncCloudBackupFromAuthSession();
        setCloud(next);
        setStatus(localeCopy.signInDone);
        return;
      }
      const redirectTo = `${canonicalAuthOriginFromLocation()}/app?settings=cloud`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (oauthError) {
        setStatus(localeCopy.signInFailed);
        return;
      }
      setStatus(localeCopy.signInDone);
    } catch {
      setStatus(localeCopy.signInFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudBackupNow() {
    const confirmed = window.confirm(localeCopy.confirmBackup);
    if (!confirmed) return;
    setBusy(true);
    setStatus(localeCopy.backingUp);
    try {
      const payload = await getAllMemories();
      await backupToCloud(payload, {
        kind: "full_export",
        memoryId: "00000000-0000-0000-0000-000000000000",
      });
      setStatus(localeCopy.backupDone);
    } catch (err) {
      const msg = err instanceof Error ? err.message : localeCopy.backupFailed;
      setStatus(
        msg === CLOUD_STORAGE_FULL_MESSAGE || msg === localeCopy.cloudStorageFull
          ? CLOUD_STORAGE_FULL_MESSAGE
          : msg || localeCopy.backupFailed
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeepSync() {
    if (typeof onDeepSync !== "function") return;
    const confirmed = window.confirm(localeCopy.confirmDeepSync);
    if (!confirmed) return;
    setBusy(true);
    setStatus(localeCopy.deepSyncRunning);
    try {
      await onDeepSync();
      await refreshLocalStats();
      setStatus(localeCopy.deepSyncDone);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : localeCopy.deepSyncFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudRestore() {
    const confirmed = window.confirm(localeCopy.confirmRestore);
    if (!confirmed) return;
    setBusy(true);
    setStatus(localeCopy.restoring);
    try {
      const result = await restoreFromCloudDeep();
      setStatus(result.message || localeCopy.restoreDone);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : localeCopy.restoreFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleCloudSignOut() {
    const confirmed = window.confirm(localeCopy.confirmUnlink);
    if (!confirmed) return;
    await signOutCloudBackup();
    setCloud(getCloudBackupSettings());
    setStatus(localeCopy.unlinkDone);
  }

  function handleTemporaryModeChange(enabled) {
    setTemporaryDeviceModeEnabled(enabled);
    setTemporaryMode(enabled);
    setStatus("");
  }

  async function handleTemporaryExitNow() {
    const confirmed = window.confirm(localeCopy.confirmTemporaryExit);
    if (!confirmed) return;
    openVerificationFor("temporary_exit");
  }

  async function runTemporaryExitNow() {
    setBusy(true);
    setStatus("");
    try {
      await wipeTemporaryDevice();
      setStatus(localeCopy.temporaryExitDone);
      await refreshLocalStats();
      onBack?.();
    } catch {
      setStatus(localeCopy.temporaryExitFailed);
    } finally {
      setBusy(false);
    }
  }

  function handleRevokeDevice(deviceId) {
    const confirmed = window.confirm(localeCopy.confirmRevokeDevice);
    if (!confirmed) return;
    revokeTrustedDevice(deviceId);
    setSecurity(getSecuritySummary());
    setStatus(localeCopy.deviceRevoked);
  }

  function buttonLabelWithBadge(label) {
    return (
      <span style={styles.buttonLabelRow}>
        <span>{label}</span>
        <span style={styles.verifyBadge}>{localeCopy.requiresVerificationBadge}</span>
      </span>
    );
  }

  function handleKeepSignedInChange(enabled) {
    setKeepSignedInPreference(enabled);
    setKeepSignedIn(enabled);
    setStatus("");
  }

  async function handleRevokeAllNfc() {
    const confirmed = window.confirm(localeCopy.confirmRevokeAllNfc);
    if (!confirmed) return;
    openVerificationFor("revoke_all_nfc");
  }

  async function runRevokeAllNfc() {
    setBusy(true);
    setStatus("");
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus(localeCopy.revokeAllNfcNeedSignIn);
        return;
      }
      const secondaryToken = await fetchSecondaryVerificationToken(
        session.access_token
      );
      const res = await fetch("/api/nfc/revoke-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "X-Haven-Secondary-Token": secondaryToken,
        },
        body: JSON.stringify({ privacy_acknowledged: true }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "revoke_all_failed");
      }
      const n = Number(payload.revoked_count ?? 0);
      setStatus(localeCopy.revokeAllNfcDone.replace("{n}", String(n)));
    } catch {
      setStatus(localeCopy.revokeAllNfcFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmVerification() {
    setVerifyError("");
    setBusy(true);
    try {
      await verifyAndTrustCurrentDevice({
        password: verifyPassword,
        recoveryCode: verifyRecoveryCode,
      });
      setVerifyOpen(false);
      const action = pendingProtectedAction;
      setPendingProtectedAction("");
      if (action === "export_backup") {
        await runExportBackup();
        return;
      }
      if (action === "clear_all") {
        await runClearAll();
        return;
      }
      if (action === "temporary_exit") {
        await runTemporaryExitNow();
        return;
      }
      if (action === "revoke_all_nfc") {
        await runRevokeAllNfc();
      }
    } catch {
      setVerifyError(localeCopy.verifyActionFailed);
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{localeCopy.title}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <button type="button" onClick={onBack} style={styles.backButton}>
          {localeCopy.back}
        </button>

        {onOpenPricing ? (
          <section style={styles.upgradeCard}>
            <h2 style={styles.sectionTitle}>{localeCopy.upgradeSectionTitle}</h2>
            <p style={styles.copy}>{localeCopy.upgradeSectionBody}</p>
            <button type="button" onClick={() => onOpenPricing()} style={styles.primaryButton}>
              {localeCopy.upgradeSectionCta}
            </button>
          </section>
        ) : null}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.accountSectionTitle}</h2>
          <p style={styles.copy}>{localeCopy.accountLocalLine}</p>
          <p style={styles.copy}>
            {cloud.user ? localeCopy.accountCloudSignedIn : localeCopy.accountCloudOff}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.subscriptionSectionTitle}</h2>
          <p style={styles.copy}>{localeCopy.subscriptionBody}</p>
          {onOpenPricing ? (
            <button type="button" onClick={() => onOpenPricing()} style={styles.secondaryButton}>
              {localeCopy.subscriptionManageCta}
            </button>
          ) : null}
        </section>

        {onOpenRings ? (
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>{localeCopy.ringsSectionTitle}</h2>
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => {
                  markOpenPartnerInviteOnRings();
                  onOpenRings();
                }}
                style={styles.primaryButton}
              >
                {localeCopy.ringsAddPartnerCta}
              </button>
              <button type="button" onClick={() => onOpenRings()} style={styles.secondaryButton}>
                {localeCopy.ringsManageCta}
              </button>
            </div>
          </section>
        ) : null}

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.dataPrivacySectionTitle}</h2>
          <p style={styles.copy}>{ex.exportSectionLead}</p>
          <p style={styles.copy}>{localeCopy.localDefault}</p>
          <p style={styles.copy}>
            {loading
              ? localeCopy.loadingStats
              : `${localeCopy.storedStatsLabel}: ${localCount}. ${localeCopy.estimatedStorageLabel}: ${storageText}.`}
          </p>
          {exportProgress > 0 && exportProgress < 100 ? (
            <div style={styles.progressWrap}>
              <p style={styles.status}>
                {ex.progressLabel}: {exportProgress}%
              </p>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressFill, width: `${exportProgress}%` }} />
              </div>
            </div>
          ) : null}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={busy || loading}
              style={styles.primaryButton}
            >
              {buttonLabelWithBadge(ex.exportSectionTitle)}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={busy || loading}
              style={styles.dangerButton}
            >
              {buttonLabelWithBadge(localeCopy.clearAll)}
            </button>
          </div>
          <p style={styles.finePrint}>{ex.formatZipHint}</p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.deviceSecuritySectionTitle}</h2>
          <p style={styles.copy}>
            {security.initialized
              ? localeCopy.deviceSecurityEnabled
              : localeCopy.deviceSecurityNotEnabled}
          </p>
          <ul style={styles.deviceList}>
            {security.trustedDevices.map((device) => (
              <li key={device.id} style={styles.deviceItem}>
                <div>
                  <p style={styles.copy}>{device.label}</p>
                  <p style={styles.status}>
                    {localeCopy.deviceTrustedAtLabel}: {new Date(device.trustedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeDevice(device.id)}
                  style={styles.secondaryButton}
                >
                  {buttonLabelWithBadge(localeCopy.revokeDevice)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.cloudSectionTitle}</h2>
          <label style={styles.toggleRow}>
            <span style={styles.copy}>
              {localeCopy.cloudToggleLabel}
            </span>
            <input
              type="checkbox"
              checked={cloud.enabled}
              disabled={busy}
              onChange={(e) => void handleToggleCloudBackup(e.target.checked)}
            />
          </label>
          <p style={styles.copy}>{cloudStateText}</p>
          <p style={styles.copyMuted}>{localeCopy.cloudPairSharingNote}</p>
          <p style={styles.copyMuted}>{localeCopy.cloudCouplePlusNote}</p>
          {havenPlus?.pairActive ? (
            <p style={styles.copy}>
              {havenPlus.isBillingAccount
                ? localeCopy.cloudBillingYou
                : localeCopy.cloudBillingPartner}
            </p>
          ) : null}
          <p style={styles.copyMuted}>{localeCopy.cloudQuotaNote}</p>
          <p style={styles.copyMuted}>{localeCopy.cloudSupplementsNote}</p>
          <p style={styles.copyMuted}>{localeCopy.deepSyncHint}</p>
          <div style={styles.actions}>
            {havenPlus?.pairActive && !havenPlus?.isBillingAccount ? (
              <button
                type="button"
                onClick={() => void handleSetMyBilling()}
                disabled={busy}
                style={styles.secondaryButton}
              >
                {localeCopy.cloudBillingChoose}
              </button>
            ) : null}
            {!canUseCloudBackup && onOpenPricing ? (
              <button type="button" onClick={() => onOpenPricing()} style={styles.primaryButton}>
                {localeCopy.upgradeSectionCta}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleSignInApple()}
              disabled={busy || !cloud.enabled || Boolean(cloud.user) || !canUseCloudBackup}
              style={buttonStyle(busy || !cloud.enabled || Boolean(cloud.user) || !canUseCloudBackup)}
            >
              {cloud.user ? localeCopy.cloudEnabledSignedIn : localeCopy.signInApple}
            </button>
            <button
              type="button"
              onClick={() => void handleCloudBackupNow()}
              disabled={busy || !cloud.enabled || !cloud.user || !canUseCloudBackup}
              style={buttonStyle(busy || !cloud.enabled || !cloud.user || !canUseCloudBackup)}
            >
              {localeCopy.backupNow}
            </button>
            <button
              type="button"
              onClick={() => void handleDeepSync()}
              disabled={busy || !canUseCloudBackup}
              style={buttonStyle(busy || !canUseCloudBackup)}
            >
              {localeCopy.deepSync}
            </button>
            <button
              type="button"
              onClick={() => void handleCloudRestore()}
              disabled={busy || !cloud.enabled || !cloud.user || !canUseCloudBackup}
              style={buttonStyle(busy || !cloud.enabled || !cloud.user || !canUseCloudBackup)}
            >
              {localeCopy.restore}
            </button>
            <button
              type="button"
              onClick={() => void handleCloudSignOut()}
              disabled={busy || !cloud.user}
              style={buttonStyle(busy || !cloud.user)}
            >
              {localeCopy.unlink}
            </button>
          </div>
          <p style={styles.complianceNote}>{havenCopy.cloudStorageDisclaimer}</p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.sessionSectionTitle}</h2>
          <label style={styles.toggleRow}>
            <span style={styles.copy}>{localeCopy.keepSignedInLabel}</span>
            <input
              type="checkbox"
              checked={keepSignedIn}
              disabled={busy}
              onChange={(e) => handleKeepSignedInChange(e.target.checked)}
            />
          </label>
          <details style={styles.advancedDetails}>
            <summary style={styles.advancedSummary}>
              {localeCopy.revokeAllNfcAdvancedSummary}
            </summary>
            <p style={styles.copy}>{localeCopy.revokeAllNfcBody}</p>
            <button
              type="button"
              onClick={() => void handleRevokeAllNfc()}
              disabled={busy}
              style={styles.dangerButton}
            >
              {buttonLabelWithBadge(localeCopy.revokeAllNfcButton)}
            </button>
          </details>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.temporarySectionTitle}</h2>
          <label style={styles.toggleRow}>
            <span style={styles.copy}>{localeCopy.temporaryModeLabel}</span>
            <input
              type="checkbox"
              checked={temporaryMode}
              disabled={busy}
              onChange={(e) => handleTemporaryModeChange(e.target.checked)}
            />
          </label>
          <p style={styles.copy}>{localeCopy.temporaryModeHelp}</p>
          <button
            type="button"
            onClick={() => void handleTemporaryExitNow()}
            disabled={busy}
            style={styles.dangerButton}
          >
            {buttonLabelWithBadge(localeCopy.temporaryExitButton)}
          </button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.feedbackSectionTitle}</h2>
          <label style={styles.toggleRow}>
            <span>
              <strong style={styles.toggleLabel}>{localeCopy.feedbackSoundsLabel}</strong>
              <span style={styles.toggleHint}>{localeCopy.feedbackSoundsHint}</span>
            </span>
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => updateFeedbackPrefs({ soundEnabled: e.target.checked })}
            />
          </label>
          <label style={styles.toggleRow}>
            <span>
              <strong style={styles.toggleLabel}>{localeCopy.feedbackHapticsLabel}</strong>
              <span style={styles.toggleHint}>{localeCopy.feedbackHapticsHint}</span>
            </span>
            <input
              type="checkbox"
              checked={hapticEnabled}
              onChange={(e) => updateFeedbackPrefs({ hapticEnabled: e.target.checked })}
            />
          </label>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.riskOpsTitle}</h2>
          <p style={styles.copy}>{localeCopy.riskOpsBody}</p>
          <ul style={styles.deviceList}>
            <li style={styles.deviceItem}>
              <p style={styles.copy}>{localeCopy.riskOpRingManage}</p>
            </li>
            <li style={styles.deviceItem}>
              <p style={styles.copy}>{localeCopy.riskOpExportMigrate}</p>
            </li>
            <li style={styles.deviceItem}>
              <p style={styles.copy}>{localeCopy.riskOpDeleteSealed}</p>
            </li>
            <li style={styles.deviceItem}>
              <p style={styles.copy}>{localeCopy.riskOpRemoteRevoke}</p>
            </li>
          </ul>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.privacySectionTitle}</h2>
          <h3 style={styles.subheading}>{localeCopy.legalSectionTitle}</h3>
          <p style={styles.copy}>
            <a href="/privacy-policy" target="_blank" rel="noreferrer" style={styles.link}>
              {localeCopy.privacyPolicy}
            </a>
            {" · "}
            <a href="/terms" target="_blank" rel="noreferrer" style={styles.link}>
              {localeCopy.termsLink}
            </a>
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyContactLabel}:{" "}
            <a href="mailto:privacy@havenring.me" style={styles.link}>
              privacy@havenring.me
            </a>
          </p>
          <p style={styles.copy}>{localeCopy.privacyLine1}</p>
          <p style={styles.copy}>{localeCopy.privacyLine2}</p>
          <p style={styles.copy}>{localeCopy.privacyNfcLine}</p>
          <p style={styles.copy}>{localeCopy.privacyUnbindLine}</p>
          <p style={styles.copy}>{localeCopy.privacyE2eLine}</p>
          <button type="button" onClick={onOpenHelp} style={styles.secondaryButton}>
            {localeCopy.openHelp}
          </button>
        </section>

        <p style={styles.status}>{status || "\u00A0"}</p>

        {exportPickerOpen ? (
          <section style={styles.verifyBox}>
            <p style={styles.sectionTitle}>{ex.chooseFormatTitle}</p>
            <label style={styles.radioRow}>
              <input
                type="radio"
                name="exportFmt"
                checked={exportFormat === "full"}
                onChange={() => setExportFormat("full")}
              />
              <span style={styles.copy}>{ex.formatJsonFull}</span>
            </label>
            <label style={styles.radioRow}>
              <input
                type="radio"
                name="exportFmt"
                checked={exportFormat === "lite"}
                onChange={() => setExportFormat("lite")}
              />
              <span style={styles.copy}>{ex.formatJsonLite}</span>
            </label>
            <div style={styles.actions}>
              <button type="button" onClick={confirmExportFormatAndVerify} style={styles.primaryButton}>
                {ex.continueToVerify}
              </button>
              <button
                type="button"
                onClick={() => setExportPickerOpen(false)}
                style={styles.ghostButton}
              >
                {localeCopy.verifyActionCancel}
              </button>
            </div>
          </section>
        ) : null}

        {verifyOpen ? (
          <section style={styles.verifyBox}>
            <p style={styles.sectionTitle}>{localeCopy.verifyModalTitle}</p>
            <p style={styles.copy}>{localeCopy.verifyModalBody}</p>
            <input
              type="password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              placeholder={localeCopy.verifyPasswordPlaceholder}
              style={styles.input}
            />
            <input
              type="text"
              value={verifyRecoveryCode}
              onChange={(e) => setVerifyRecoveryCode(e.target.value)}
              placeholder={localeCopy.verifyRecoveryPlaceholder}
              style={styles.input}
            />
            {verifyError ? <p style={styles.status}>{verifyError}</p> : null}
            <div style={styles.actions}>
              <button
                type="button"
                onClick={() => void handleConfirmVerification()}
                disabled={busy}
                style={styles.secondaryButton}
              >
                {localeCopy.verifyActionConfirm}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerifyOpen(false);
                  setPendingProtectedAction("");
                  setVerifyError("");
                }}
                disabled={busy}
                style={styles.ghostButton}
              >
                {localeCopy.verifyActionCancel}
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function buttonStyle(disabled) {
  return {
    ...styles.secondaryButton,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

async function estimateStorage(unavailableText) {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return unavailableText;
  }
  const result = await navigator.storage.estimate();
  const used = Number(result.usage || 0);
  const quota = Number(result.quota || 0);
  if (!used || !quota) return unavailableText;
  return `${formatBytes(used)} / ${formatBytes(quota)}`;
}

function formatBytes(value) {
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const styles = {
  page: {
    minHeight: "min-content",
    padding: APP_PAGE_PADDING,
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 560,
    margin: "0 auto",
    width: "100%",
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
    fontSize: 30,
    fontWeight: 500,
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
  upgradeCard: {
    border: "1px solid rgba(196, 149, 106, 0.45)",
    borderRadius: 14,
    background: "rgba(44, 36, 31, 0.55)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  primaryButton: {
    justifySelf: "start",
    border: `1px solid ${sanctuaryTheme.accent}`,
    background: `linear-gradient(180deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    color: sanctuaryTheme.ink,
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 15,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 44,
    cursor: "pointer",
  },
  toggleLabel: {
    display: "block",
    fontSize: 15,
    fontWeight: 600,
    color: sanctuaryTheme.cream,
  },
  toggleHint: {
    display: "block",
    marginTop: 4,
    fontSize: 13,
    color: "#d9c3b3",
    fontWeight: 400,
  },
  subheading: {
    margin: "12px 0 0",
    fontSize: 15,
    fontWeight: 600,
  },
  copy: {
    margin: 0,
    color: "#d9c3b3",
    lineHeight: 1.6,
  },
  copyMuted: {
    margin: 0,
    color: "#a89284",
    fontSize: 13,
    lineHeight: 1.5,
  },
  complianceNote: {
    margin: "4px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(217, 195, 179, 0.75)",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  deviceList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 8,
  },
  deviceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid #3a2d28",
    borderRadius: 10,
    padding: 10,
  },
  secondaryButton: {
    border: "1px solid #5a3b30",
    background: "transparent",
    color: "#f8efe7",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  dangerButton: {
    border: "1px solid #7d3f34",
    background: "transparent",
    color: "#ffb8a3",
    borderRadius: 999,
    padding: "8px 12px",
    cursor: "pointer",
  },
  toggleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  link: {
    color: "#f0c29e",
    textDecoration: "none",
  },
  status: {
    margin: 0,
    minHeight: 18,
    color: "#f2d8c5",
    fontSize: 13,
  },
  buttonLabelRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  verifyBadge: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    border: "1px solid rgba(240, 194, 158, 0.45)",
    borderRadius: 999,
    padding: "2px 6px",
    color: "#f0c29e",
    whiteSpace: "nowrap",
  },
  verifyBox: {
    border: "1px solid rgba(240, 194, 158, 0.35)",
    borderRadius: 14,
    background: "rgba(44, 36, 31, 0.42)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  input: {
    border: "1px solid rgba(196, 149, 106, 0.45)",
    borderRadius: 10,
    background: "rgba(18, 13, 13, 0.45)",
    color: sanctuaryTheme.cream,
    padding: "10px 12px",
  },
  ghostButton: {
    border: "none",
    background: "transparent",
    color: sanctuaryTheme.inkSoft,
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: 14,
    padding: "10px 8px",
  },
  progressWrap: {
    display: "grid",
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(0,0,0,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: `linear-gradient(90deg, ${sanctuaryTheme.accentSoft}, ${sanctuaryTheme.accent})`,
    transition: "width 0.2s ease-out",
  },
  finePrint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(248, 239, 231, 0.55)",
  },
  radioRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    cursor: "pointer",
  },
  advancedDetails: {
    marginTop: 12,
  },
  advancedSummary: {
    cursor: "pointer",
    color: "rgba(248, 239, 231, 0.55)",
    fontSize: 13,
    marginBottom: 8,
  },
};
