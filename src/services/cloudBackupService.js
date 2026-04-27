/**
 * Haven Ring - Optional Cloud Backup Service (Framework)
 *
 * Design principles:
 * - Optional only; default is local-first.
 * - Cloud backup works only when user explicitly enables it and signs in.
 * - Keep implementation provider-agnostic for future extension.
 */

const PREF_KEY = "haven.cloud-backup.settings.v1";

function readBackupSettings() {
  if (typeof window === "undefined") {
    return { enabled: false, provider: "apple", user: null };
  }
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return { enabled: false, provider: "apple", user: null };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled === true,
      provider: parsed?.provider || "apple",
      user: parsed?.user || null,
    };
  } catch {
    return { enabled: false, provider: "apple", user: null };
  }
}

function writeBackupSettings(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
}

export function getCloudBackupSettings() {
  return readBackupSettings();
}

export function setCloudBackupEnabled(enabled) {
  const prev = readBackupSettings();
  const next = {
    ...prev,
    enabled: Boolean(enabled),
  };
  writeBackupSettings(next);
  return next;
}

/**
 * Placeholder sign-in flow.
 * In production, replace with real Sign in with Apple / OAuth SDK.
 */
export async function signInWithApple() {
  const prev = readBackupSettings();
  const fakeUser = {
    id: "pending-provider-user-id",
    provider: "apple",
    email: null,
    linkedAt: Date.now(),
  };
  const next = {
    ...prev,
    enabled: true,
    provider: "apple",
    user: fakeUser,
  };
  writeBackupSettings(next);
  return fakeUser;
}

export async function signOutCloudBackup() {
  const prev = readBackupSettings();
  const next = {
    ...prev,
    user: null,
  };
  writeBackupSettings(next);
  return next;
}

function ensureReady() {
  const settings = readBackupSettings();
  if (!settings.enabled) {
    throw new Error("Cloud backup is disabled. Enable it first.");
  }
  if (!settings.user) {
    throw new Error("Cloud backup requires sign-in before backup or restore.");
  }
  return settings;
}

/**
 * Framework method: backup local payload to cloud.
 * Replace TODO with provider API integration.
 */
export async function backupToCloud(payload) {
  const settings = ensureReady();
  const envelope = {
    version: 1,
    backedUpAt: Date.now(),
    provider: settings.provider,
    userId: settings.user.id,
    payload,
  };

  // TODO: POST envelope to cloud endpoint.
  // await fetch("/api/cloud-backup/upload", { method: "POST", body: JSON.stringify(envelope) })
  return { ok: true, envelope };
}

/**
 * Framework method: restore payload from cloud.
 * Replace TODO with provider API integration.
 */
export async function restoreFromCloud() {
  const settings = ensureReady();

  // TODO: fetch latest backup snapshot from cloud backend.
  // const response = await fetch("/api/cloud-backup/latest?userId=...")
  // return await response.json()
  return {
    ok: true,
    provider: settings.provider,
    payload: null,
    message: "No cloud snapshot yet. Framework is ready for integration.",
  };
}
