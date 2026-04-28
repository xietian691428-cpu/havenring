const SECURITY_KEY = "haven.security.profile.v1";
const DEVICE_ID_KEY = "haven.device.id.v1";
const ACCESS_GRANT_PREFIX = "haven.ring.access.grant.";
const ACCESS_GRANT_TTL_MS = 10 * 60 * 1000;
const DEVICE_REVERIFY_IDLE_MS = 30 * 24 * 60 * 60 * 1000;

function ensureWebCrypto() {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function sha256(text) {
  ensureWebCrypto();
  const data = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

async function hashWithSalt(value, salt) {
  return sha256(`${salt}:${value}`);
}

function readProfile() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SECURITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile) {
  window.localStorage.setItem(SECURITY_KEY, JSON.stringify(profile));
}

function getDeviceLabel() {
  const ua = navigator.userAgent || "";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android device";
  if (/macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows PC";
  return "This device";
}

export function getOrCreateDeviceId() {
  const current = window.localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const next = `dev_${randomHex(12)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}

export function getTrustedDevices() {
  const profile = readProfile();
  if (!profile?.devices) return [];
  return profile.devices.filter((d) => !d.revokedAt);
}

export function isSecurityInitialized() {
  const profile = readProfile();
  return Boolean(profile?.master?.hash && profile?.master?.salt);
}

export function isCurrentDeviceTrusted() {
  const profile = readProfile();
  if (!profile?.devices?.length) return false;
  const deviceId = getOrCreateDeviceId();
  return profile.devices.some((d) => d.id === deviceId && !d.revokedAt);
}

export function requiresReverificationCurrentDevice() {
  const profile = readProfile();
  if (!profile?.devices?.length) return false;
  const deviceId = getOrCreateDeviceId();
  const device = profile.devices.find((d) => d.id === deviceId && !d.revokedAt);
  if (!device?.lastVerifiedAt) return true;
  return Date.now() - device.lastVerifiedAt > DEVICE_REVERIFY_IDLE_MS;
}

function upsertTrustedDevice(profile) {
  const deviceId = getOrCreateDeviceId();
  const now = Date.now();
  const nextDevices = Array.isArray(profile.devices) ? [...profile.devices] : [];
  const idx = nextDevices.findIndex((d) => d.id === deviceId);
  const next = {
    id: deviceId,
    label: getDeviceLabel(),
    trustedAt: idx >= 0 ? nextDevices[idx].trustedAt : now,
    lastVerifiedAt: now,
    revokedAt: null,
  };
  if (idx >= 0) {
    nextDevices[idx] = next;
  } else {
    nextDevices.push(next);
  }
  return nextDevices;
}

function newRecoveryCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint8Array(12);
  window.crypto.getRandomValues(values);
  const body = Array.from(values, (v) => chars[v % chars.length]).join("");
  return `${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export async function initializeSecurity(password) {
  if (!password || password.length < 6) {
    throw new Error("Password too short.");
  }
  const salt = randomHex(16);
  const passwordHash = await hashWithSalt(password, salt);
  const recoveryCode = newRecoveryCode();
  const recoveryHash = await hashWithSalt(recoveryCode, salt);
  const profile = {
    version: 1,
    createdAt: Date.now(),
    master: { salt, hash: passwordHash },
    recovery: { hash: recoveryHash },
    devices: upsertTrustedDevice({ devices: [] }),
  };
  writeProfile(profile);
  return { recoveryCode };
}

export async function verifyAndTrustCurrentDevice({
  password = "",
  recoveryCode = "",
}) {
  const profile = readProfile();
  if (!profile?.master?.salt || !profile?.master?.hash) {
    throw new Error("Security not initialized.");
  }
  const normalizedRecovery = String(recoveryCode || "")
    .trim()
    .toUpperCase();
  const normalizedPassword = String(password || "").trim();
  let valid = false;
  if (normalizedPassword) {
    const hash = await hashWithSalt(normalizedPassword, profile.master.salt);
    valid = hash === profile.master.hash;
  }
  if (!valid && normalizedRecovery) {
    const hash = await hashWithSalt(normalizedRecovery, profile.master.salt);
    valid = hash === profile.recovery?.hash;
  }
  if (!valid) {
    throw new Error("Verification failed.");
  }
  profile.devices = upsertTrustedDevice(profile);
  writeProfile(profile);
  return true;
}

export function revokeTrustedDevice(deviceId) {
  const profile = readProfile();
  if (!profile?.devices?.length) return false;
  const now = Date.now();
  profile.devices = profile.devices.map((d) =>
    d.id === deviceId ? { ...d, revokedAt: now } : d
  );
  writeProfile(profile);
  return true;
}

export function getSecuritySummary() {
  return {
    initialized: isSecurityInitialized(),
    trustedCurrentDevice: isCurrentDeviceTrusted(),
    deviceId: getOrCreateDeviceId(),
    trustedDevices: getTrustedDevices(),
  };
}

async function tokenGrantKey(token) {
  const tokenHash = await sha256(String(token || ""));
  return `${ACCESS_GRANT_PREFIX}${tokenHash}`;
}

export async function grantRingAccess(token) {
  const key = await tokenGrantKey(token);
  const payload = {
    expiresAt: Date.now() + ACCESS_GRANT_TTL_MS,
  };
  window.sessionStorage.setItem(key, JSON.stringify(payload));
}

export async function hasRingAccessGrant(token) {
  const key = await tokenGrantKey(token);
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    window.sessionStorage.removeItem(key);
    return false;
  }
}
