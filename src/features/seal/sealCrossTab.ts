import { SEAL_ARM_TTL_MS } from "@/lib/seal-flow";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const LOCK_TTL_MS = 20_000;
const COMPLETE_TTL_MS = 90_000;

type SealWaitTabMarker = { ts: number };

type SealResolveLock = { id: string; expiresAt: number };
type SealCompleteRelay = { ts: number };

function readLock(): SealResolveLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sealResolveLock);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SealResolveLock>;
    if (typeof parsed.id !== "string" || typeof parsed.expiresAt !== "number") return null;
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(STORAGE_KEYS.sealResolveLock);
      return null;
    }
    return { id: parsed.id, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

/** One tab owns SDM resolve at a time (prevents replay when wait tab also navigates). */
export function tryAcquireSealResolveLock(): string | null {
  if (typeof window === "undefined") return null;
  const existing = readLock();
  if (existing) return null;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload: SealResolveLock = { id, expiresAt: Date.now() + LOCK_TTL_MS };
  try {
    window.localStorage.setItem(STORAGE_KEYS.sealResolveLock, JSON.stringify(payload));
    const verify = readLock();
    return verify?.id === id ? id : null;
  } catch {
    return null;
  }
}

export function releaseSealResolveLock(lockId: string | null | undefined) {
  if (typeof window === "undefined" || !lockId) return;
  try {
    const current = readLock();
    if (current?.id === lockId) {
      window.localStorage.removeItem(STORAGE_KEYS.sealResolveLock);
    }
  } catch {
    /* ignore */
  }
}

export function broadcastSealComplete() {
  if (typeof window === "undefined") return;
  try {
    const payload: SealCompleteRelay = { ts: Date.now() };
    window.localStorage.setItem(
      STORAGE_KEYS.sealCompleteRelay,
      JSON.stringify(payload)
    );
  } catch {
    /* ignore */
  }
}

export function wasSealRecentlyCompleted(maxAgeMs = COMPLETE_TTL_MS): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sealCompleteRelay);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<SealCompleteRelay>;
    return typeof parsed.ts === "number" && Date.now() - parsed.ts <= maxAgeMs;
  } catch {
    return false;
  }
}

export const SEAL_COMPLETE_STORAGE_KEY = STORAGE_KEYS.sealCompleteRelay;

/** Wait page holds seal prep; NFC may open a sibling tab that must not burn SDM. */
export function markSealWaitTabActive() {
  if (typeof window === "undefined") return;
  try {
    const payload: SealWaitTabMarker = { ts: Date.now() };
    window.localStorage.setItem(
      STORAGE_KEYS.sealWaitTabActive,
      JSON.stringify(payload)
    );
  } catch {
    /* ignore */
  }
}

export function clearSealWaitTabActive() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.sealWaitTabActive);
  } catch {
    /* ignore */
  }
}

export function isSealWaitTabActive(maxAgeMs = SEAL_ARM_TTL_MS): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sealWaitTabActive);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<SealWaitTabMarker>;
    return typeof parsed.ts === "number" && Date.now() - parsed.ts <= maxAgeMs;
  } catch {
    return false;
  }
}
