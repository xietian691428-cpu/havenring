import { MAX_SEAL_DRAFT_IDS } from "./seal-shared";

/** Dual-storage arm window for Seal-with-Ring (session + local for cross-tab NFC). */
export const SEAL_ARMED_KEY = "haven.seal.armed.v1";

/** Keep consistent with server ticket TTL defaults (`lib/seal-shared.ts`). */
export const SEAL_ARM_TTL_MS = 5 * 60 * 1000;

export type SealArmedPayload = {
  expiresAt: number;
  draftIds: string[];
  timestamp: number;
  /** @deprecated Legacy field — prefer `timestamp`. */
  armedAt?: number;
};

type StorageKind = "sessionStorage" | "localStorage";

function normalizeDraftIds(ids: string[] = []): string[] {
  return ids
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SEAL_DRAFT_IDS);
}

function isExpired(data: SealArmedPayload | null): boolean {
  return !data || typeof data.expiresAt !== "number" || Date.now() > data.expiresAt;
}

function parseArmedPayload(raw: string | null): SealArmedPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SealArmedPayload> & { armedAt?: number };
    if (typeof parsed.expiresAt !== "number") return null;
    const draftIds = Array.isArray(parsed.draftIds)
      ? normalizeDraftIds(parsed.draftIds)
      : [];
    const timestamp =
      typeof parsed.timestamp === "number"
        ? parsed.timestamp
        : typeof parsed.armedAt === "number"
          ? parsed.armedAt
          : Date.now();
    return {
      expiresAt: parsed.expiresAt,
      draftIds,
      timestamp,
    };
  } catch {
    return null;
  }
}

function getFromStorage(type: StorageKind): SealArmedPayload | null {
  if (typeof window === "undefined") return null;
  const key = SEAL_ARMED_KEY;
  try {
    const str =
      type === "sessionStorage"
        ? window.sessionStorage.getItem(key)
        : window.localStorage.getItem(key);
    const data = parseArmedPayload(str);
    if (!data || isExpired(data)) {
      if (str) {
        if (type === "sessionStorage") {
          window.sessionStorage.removeItem(key);
        } else {
          window.localStorage.removeItem(key);
        }
      }
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeArmedPayload(data: SealArmedPayload) {
  if (typeof window === "undefined") return;
  const serialized = JSON.stringify(data);
  try {
    window.sessionStorage.setItem(SEAL_ARMED_KEY, serialized);
  } catch {
    /* quota / private mode */
  }
  try {
    window.localStorage.setItem(SEAL_ARMED_KEY, serialized);
  } catch {
    /* quota / private mode */
  }
}

function clearArmedStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SEAL_ARMED_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.localStorage.removeItem(SEAL_ARMED_KEY);
  } catch {
    /* ignore */
  }
}

/** Active non-expired arm payload (session first, then local with session rehydrate). */
export function readActiveSealArmedPayload(): SealArmedPayload | null {
  if (typeof window === "undefined") return null;

  let data = getFromStorage("sessionStorage");
  if (data && !isExpired(data)) return data;

  data = getFromStorage("localStorage");
  if (data && !isExpired(data)) {
    writeArmedPayload(data);
    return data;
  }

  return null;
}

/**
 * Arm the seal window with draft ids persisted in both storages (fixes ring tap opening a new tab).
 */
export function armSealFlowWithPersistence(draftIds: string[] = []) {
  if (typeof window === "undefined") return;
  const expiresAt = Date.now() + SEAL_ARM_TTL_MS;
  const data: SealArmedPayload = {
    expiresAt,
    draftIds: normalizeDraftIds(draftIds),
    timestamp: Date.now(),
  };
  writeArmedPayload(data);
}

/** @deprecated Prefer `armSealFlowWithPersistence(draftIds)`. Arms without embedded draft ids. */
export function armSealFlow() {
  armSealFlowWithPersistence([]);
}

export function clearSealFlowArm() {
  clearArmedStorage();
}

export function isSealFlowArmed(): boolean {
  return readActiveSealArmedPayload() !== null;
}

/** Draft ids stored in the active arm payload (empty if not armed). */
export function getArmedSealDraftIds(): string[] {
  const payload = readActiveSealArmedPayload();
  return payload?.draftIds ?? [];
}

/** Milliseconds until the armed seal window ends (0 if not armed or expired). */
export function getSealArmedRemainingMs(): number {
  const payload = readActiveSealArmedPayload();
  if (!payload) return 0;
  const left = payload.expiresAt - Date.now();
  if (left <= 0) {
    clearSealFlowArm();
    return 0;
  }
  return left;
}
