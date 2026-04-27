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
  signInWithApple,
  signOutCloudBackup,
} from "../services/cloudBackupService";
import { SETTINGS_CONTENT } from "../content/settingsContent";

/**
 * Settings Page
 * - Local data management
 * - Optional cloud backup switch
 * - Privacy-first messaging
 */
export function SettingsPage({ onBack, onOpenHelp, locale = "en" }) {
  const localeCopy = SETTINGS_CONTENT[locale] || SETTINGS_CONTENT.en;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const [storageText, setStorageText] = useState(localeCopy.loadingStats);
  const [cloud, setCloud] = useState(() => getCloudBackupSettings());

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
      await signInWithApple();
      setCloud(getCloudBackupSettings());
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

  return (
    <main style={styles.page}>
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
          <h2 style={styles.sectionTitle}>{localeCopy.privacySectionTitle}</h2>
          <p style={styles.copy}>
            {localeCopy.privacyLine1}
          </p>
          <p style={styles.copy}>
            {localeCopy.privacyLine2}
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
    background: "radial-gradient(circle at top, #281d18 0%, #120f0e 56%)",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
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
    color: "#d9c3b3",
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
    border: "1px solid #3a2d28",
    borderRadius: 14,
    background: "#171210",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
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
