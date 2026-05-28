const NFC_LOCK_KEY = "__havenNfcLockState";
const MAX_LOCK_MS = 15_000;

function nowMs() {
  return Date.now();
}

function readLock() {
  if (typeof window === "undefined") return null;
  return window[NFC_LOCK_KEY] || null;
}

function writeLock(state) {
  if (typeof window === "undefined") return;
  window[NFC_LOCK_KEY] = state;
}

export function isNfcLockActive() {
  const lock = readLock();
  if (!lock) return false;
  if (nowMs() > lock.expiresAt) {
    clearNfcLock("expired");
    return false;
  }
  return true;
}

export function acquireNfcLock(owner = "unknown", ttlMs = MAX_LOCK_MS) {
  if (typeof window === "undefined") return { ok: true, release: () => {} };
  if (isNfcLockActive()) {
    const lock = readLock();
    return {
      ok: false,
      owner: lock?.owner || "unknown",
      release: () => {},
    };
  }
  const state = {
    owner,
    acquiredAt: nowMs(),
    expiresAt: nowMs() + Math.max(1_000, Math.min(ttlMs, MAX_LOCK_MS)),
  };
  writeLock(state);
  return {
    ok: true,
    owner,
    release: () => clearNfcLock(owner),
  };
}

export function clearNfcLock(requestor = "unknown") {
  if (typeof window === "undefined") return;
  const lock = readLock();
  if (!lock) return;
  if (lock.owner !== requestor && nowMs() <= lock.expiresAt) {
    // Allow force-clear only when expired or same owner.
    return;
  }
  writeLock(null);
}

export function forceClearNfcLock() {
  if (typeof window === "undefined") return;
  writeLock(null);
}

