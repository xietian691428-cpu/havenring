/** SessionStorage “armed” window for Seal-with-Ring (see `src/features/seal`). */
const SEAL_ARMED_KEY = "haven.seal.armed.v1";
/** Keep consistent with server ticket TTL defaults (`lib/seal-shared.ts`). */
const SEAL_ARM_TTL_MS = 5 * 60 * 1000;

export function armSealFlow() {
  if (typeof window === "undefined") return;
  const payload = {
    armedAt: Date.now(),
    expiresAt: Date.now() + SEAL_ARM_TTL_MS,
  };
  window.sessionStorage.setItem(SEAL_ARMED_KEY, JSON.stringify(payload));
}

export function clearSealFlowArm() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SEAL_ARMED_KEY);
}

export function isSealFlowArmed() {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(SEAL_ARMED_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SEAL_ARMED_KEY);
      return false;
    }
    return true;
  } catch {
    window.sessionStorage.removeItem(SEAL_ARMED_KEY);
    return false;
  }
}

/** Milliseconds until the armed seal window ends (0 if not armed or expired). Sync with NewMemoryPage arm window. */
export function getSealArmedRemainingMs(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(SEAL_ARMED_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed?.expiresAt) return 0;
    const left = parsed.expiresAt - Date.now();
    if (left <= 0) {
      window.sessionStorage.removeItem(SEAL_ARMED_KEY);
      return 0;
    }
    return left;
  } catch {
    return 0;
  }
}
