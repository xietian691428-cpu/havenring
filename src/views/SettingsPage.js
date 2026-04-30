import { useEffect, useMemo, useState } from "react";
import { OnlineStatusBadge } from "../components/OnlineStatusBadge";
import {
  clearAllMemories,
  getAllMemories,
} from "../services/localStorageService";
import {
  backupToCloud,
  getCloudBackupSettings,
  restoreFromCloud,
  setCloudBackupEnabled,
  signOutCloudBackup,
} from "../services/cloudBackupService";
import { SETTINGS_CONTENT } from "../content/settingsContent";
import {
  getKeepSignedInPreference,
  getSecuritySummary,
  revokeTrustedDevice,
  setKeepSignedInPreference,
} from "../services/deviceTrustService";
import {
  isTemporaryDeviceModeEnabled,
  setTemporaryDeviceModeEnabled,
  wipeTemporaryDevice,
} from "../services/temporaryDeviceService";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { sanctuaryBackgroundStyle, sanctuaryTheme } from "../theme/sanctuaryTheme";

/**
 * Settings Page
 * - Local data management
 * - Optional cloud backup switch
 * - Privacy-first messaging
 */
export function SettingsPage({
  onBack,
  onOpenHelp,
  onLocalDataCleared,
  locale = "en",
}) {
  const localeCopy = SETTINGS_CONTENT[locale] || SETTINGS_CONTENT.en;
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

  const cloudStateText = useMemo(() => {
    if (!cloud.enabled) return localeCopy.cloudOff;
    if (!cloud.user) return localeCopy.cloudEnabledNoSignIn;
    return localeCopy.cloudEnabledSignedIn;
  }, [cloud.enabled, cloud.user, localeCopy]);

  useEffect(() => {
    void refreshLocalStats();
  }, []);

  async function refreshLocalStats() {
    setLoading(true);
    try {
      const memories = await getAllMemories();
      setLocalCount(memories.length);
      const estimate = await estimateStorage(localeCopy.storageUnavailable);
      setStorageText(estimate);
    } catch (error) {
      setStatus(localeCopy.loadStatsFailed);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportBackup() {
    const confirmed = window.confirm(localeCopy.confirmExport);
    if (!confirmed) return;

    setBusy(true);
    setStatus(localeCopy.preparingExport);
    try {
      const memories = await getAllMemories();
      const backup = {
        exportedAt: Date.now(),
        type: "haven-local-backup-v1",
        memories,
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `haven-backup-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus(localeCopy.exportDone);
    } catch (error) {
      setStatus(localeCopy.exportFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    const confirmed = window.confirm(localeCopy.confirmClear);
    if (!confirmed) return;

    setBusy(true);
    setStatus(localeCopy.clearing);
    try {
      await clearAllMemories();
      await refreshLocalStats();
      await onLocalDataCleared?.();
      setStatus(localeCopy.clearDone);
    } catch (error) {
      setStatus(localeCopy.clearFailed);
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
      const redirectTo = `${window.location.origin}/`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo },
      });
      if (oauthError) {
        setStatus(localeCopy.signInFailed);
        return;
      }
      // Redirect starts immediately on success.
      setStatus(localeCopy.signInDone);
    } catch (error) {
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
      await backupToCloud(payload);
      setStatus(localeCopy.backupDone);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : localeCopy.backupFailed);
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
      const result = await restoreFromCloud();
      setStatus(result.message || localeCopy.restoreDone);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : localeCopy.restoreFailed);
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

  function handleKeepSignedInChange(enabled) {
    setKeepSignedInPreference(enabled);
    setKeepSignedIn(enabled);
    setStatus("");
  }

  async function handleRevokeAllNfc() {
    const confirmed = window.confirm(localeCopy.confirmRevokeAllNfc);
    if (!confirmed) return;
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
      const res = await fetch("/api/nfc/revoke-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          "X-Haven-Secondary-Verified": "1",
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

  return (
    <main style={{ ...styles.page, ...sanctuaryBackgroundStyle() }}>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.brand}>{localeCopy.brand}</p>
            <h1 style={styles.title}>{localeCopy.title}</h1>
          </div>
          <OnlineStatusBadge locale={locale} />
        </header>

        <button type="button" onClick={onBack} style={styles.backButton}>
          {localeCopy.back}
        </button>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.localSectionTitle}</h2>
          <p style={styles.copy}>
            {localeCopy.localDefault}
          </p>
          <p style={styles.copy}>
            {loading
              ? localeCopy.loadingStats
              : `${localeCopy.storedStatsLabel}: ${localCount}. ${localeCopy.estimatedStorageLabel}: ${storageText}.`}
          </p>
          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={busy || loading}
              style={styles.secondaryButton}
            >
              {localeCopy.exportBackup}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              disabled={busy || loading}
              style={styles.dangerButton}
            >
              {localeCopy.clearAll}
            </button>
          </div>
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
                  {localeCopy.revokeDevice}
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
          <div style={styles.actions}>
            <button
              type="button"
              onClick={handleSignInApple}
              disabled={busy || !cloud.enabled}
              style={styles.secondaryButton}
            >
              {localeCopy.signInApple}
            </button>
            <button
              type="button"
              onClick={handleCloudBackupNow}
              disabled={busy || !cloud.enabled || !cloud.user}
              style={styles.secondaryButton}
            >
              {localeCopy.backupNow}
            </button>
            <button
              type="button"
              onClick={handleCloudRestore}
              disabled={busy || !cloud.enabled || !cloud.user}
              style={styles.secondaryButton}
            >
              {localeCopy.restore}
            </button>
            <button
              type="button"
              onClick={handleCloudSignOut}
              disabled={busy || !cloud.user}
              style={styles.secondaryButton}
            >
              {localeCopy.unlink}
            </button>
          </div>
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
          <h3 style={styles.subheading}>{localeCopy.revokeAllNfcTitle}</h3>
          <p style={styles.copy}>{localeCopy.revokeAllNfcBody}</p>
          <button
            type="button"
            onClick={() => void handleRevokeAllNfc()}
            disabled={busy}
            style={styles.dangerButton}
          >
            {localeCopy.revokeAllNfcButton}
          </button>
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
            {localeCopy.temporaryExitButton}
          </button>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{localeCopy.privacySectionTitle}</h2>
          <p style={styles.copy}>
            {localeCopy.privacyLine1}
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyLine2}
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyNfcLine}
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyUnbindLine}
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyE2eLine}
          </p>
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            {localeCopy.privacyPolicy}
          </a>
          <button
            type="button"
            onClick={onOpenHelp}
            style={styles.secondaryButton}
          >
            {localeCopy.openHelp}
          </button>
        </section>

        <p style={styles.status}>{status || "\u00A0"}</p>
      </section>
    </main>
  );
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
    minHeight: "100vh",
    padding: 20,
    color: sanctuaryTheme.cream,
    fontFamily: sanctuaryTheme.font,
  },
  shell: {
    maxWidth: 860,
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
  sectionTitle: {
    margin: 0,
    fontSize: 18,
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
};
