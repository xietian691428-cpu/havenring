/**
 * Local registry of NFC rings the user has named during setup (PWA).
 * Server-side claim stays authoritative for tokens; this stores UX metadata + uid fingerprint.
 */

const STORAGE_KEY = "haven.ring.registry.v1";
const ACTIVE_RING_KEY = "haven.ring.active.uidKey.v1";

export const MAX_BOUND_RINGS = 5;

function ensureWebCrypto() {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(text) {
  ensureWebCrypto();
  const data = new TextEncoder().encode(text);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest));
}

function readRaw() {
  if (typeof window === "undefined") return { rings: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rings: [] };
    const parsed = JSON.parse(raw);
    return {
      rings: Array.isArray(parsed.rings) ? parsed.rings : [],
    };
  } catch {
    return { rings: [] };
  }
}

function writeRaw(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Prefer NFC tag serial when exposed by Web NFC; otherwise hash first NDEF payload.
 */
export async function computeRingUidKey(serialNumber, fallbackText) {
  const sn = serialNumber && String(serialNumber).trim();
  if (sn) {
    return sha256(`nfc-uid:${sn}`);
  }
  const fb = String(fallbackText || "").trim();
  return sha256(`ndef-fallback:${fb || "empty"}`);
}

export function getBoundRings() {
  return readRaw().rings;
}

export function getActiveRingUidKey() {
  if (typeof window === "undefined") return "";
  const key = window.localStorage.getItem(ACTIVE_RING_KEY) || "";
  if (!key) return "";
  const rings = getBoundRings();
  if (!rings.some((ring) => ring.uidKey === key)) return "";
  return key;
}

export function setActiveRingUidKey(uidKey) {
  if (typeof window === "undefined") return;
  const next = String(uidKey || "");
  if (!next) {
    window.localStorage.removeItem(ACTIVE_RING_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_RING_KEY, next);
}

export function getActiveRingOrFirst() {
  const rings = getBoundRings();
  if (!rings.length) return null;
  const activeKey = getActiveRingUidKey();
  if (!activeKey) return rings[0];
  return rings.find((ring) => ring.uidKey === activeKey) || rings[0];
}

export function getBoundRingCount() {
  return getBoundRings().length;
}

export function canAddAnotherRing() {
  return getBoundRingCount() < MAX_BOUND_RINGS;
}

export function findRingByUidKey(uidKey) {
  return getBoundRings().find((r) => r.uidKey === uidKey) ?? null;
}

/**
 * @param {{ serialNumber?: string | null, fallbackText?: string, label: string, colorKey: string, icon?: string, cloudRingId?: string, cloudBoundAt?: string | null, cloudLastUsedAt?: string | null }} params
 */
export async function addBoundRing(params) {
  const {
    serialNumber,
    fallbackText,
    label,
    colorKey,
    icon,
    cloudRingId,
    cloudBoundAt,
    cloudLastUsedAt,
  } = params;
  const uidKey = await computeRingUidKey(serialNumber, fallbackText);
  const state = readRaw();
  if (state.rings.some((r) => r.uidKey === uidKey)) {
    const err = new Error("duplicate_ring");
    err.code = "duplicate_ring";
    throw err;
  }
  if (state.rings.length >= MAX_BOUND_RINGS) {
    const err = new Error("ring_limit");
    err.code = "ring_limit";
    throw err;
  }
  const next = {
    rings: [
      ...state.rings,
      {
        uidKey,
        label: String(label || "").trim() || "Ring",
        colorKey: colorKey || "gold",
        icon: icon || "💍",
        createdAt: Date.now(),
        cloudRingId: cloudRingId || null,
        cloudBoundAt: cloudBoundAt || null,
        cloudLastUsedAt: cloudLastUsedAt || null,
      },
    ],
  };
  writeRaw(next);
  setActiveRingUidKey(uidKey);
  return next.rings[next.rings.length - 1];
}

export async function setActiveRingFromScan(serialNumber, fallbackText) {
  const uidKey = await computeRingUidKey(serialNumber, fallbackText);
  setActiveRingUidKey(uidKey);
  return uidKey;
}

export async function setActiveRingFromNormalizedUid(normalizedUid) {
  const uidKey = await computeRingUidKey(normalizedUid, "");
  setActiveRingUidKey(uidKey);
  return uidKey;
}

export function updateRingCloudMetadata(uidKey, meta = {}) {
  const state = readRaw();
  const next = {
    rings: state.rings.map((ring) =>
      ring.uidKey === uidKey
        ? {
            ...ring,
            cloudRingId: meta.cloudRingId ?? ring.cloudRingId ?? null,
            cloudBoundAt: meta.cloudBoundAt ?? ring.cloudBoundAt ?? null,
            cloudLastUsedAt: meta.cloudLastUsedAt ?? ring.cloudLastUsedAt ?? null,
          }
        : ring
    ),
  };
  writeRaw(next);
  return next.rings.find((ring) => ring.uidKey === uidKey) || null;
}

export function upsertBoundRingByUidKey(uidKey, patch = {}) {
  const key = String(uidKey || "");
  if (!key) return null;
  const state = readRaw();
  const idx = state.rings.findIndex((ring) => ring.uidKey === key);
  if (idx >= 0) {
    const next = {
      rings: state.rings.map((ring, i) =>
        i === idx
          ? {
              ...ring,
              label: patch.label ?? ring.label,
              colorKey: patch.colorKey ?? ring.colorKey,
              icon: patch.icon ?? ring.icon,
              cloudRingId: patch.cloudRingId ?? ring.cloudRingId ?? null,
              cloudBoundAt: patch.cloudBoundAt ?? ring.cloudBoundAt ?? null,
              cloudLastUsedAt: patch.cloudLastUsedAt ?? ring.cloudLastUsedAt ?? null,
            }
          : ring
      ),
    };
    writeRaw(next);
    setActiveRingUidKey(key);
    return next.rings[idx];
  }
  if (state.rings.length >= MAX_BOUND_RINGS) return null;
  const inserted = {
    uidKey: key,
    label: String(patch.label || "").trim() || "Recovered ring",
    colorKey: patch.colorKey || "gold",
    icon: patch.icon || "💍",
    createdAt: Date.now(),
    cloudRingId: patch.cloudRingId || null,
    cloudBoundAt: patch.cloudBoundAt || null,
    cloudLastUsedAt: patch.cloudLastUsedAt || null,
  };
  const next = { rings: [...state.rings, inserted] };
  writeRaw(next);
  setActiveRingUidKey(key);
  return inserted;
}

export function removeBoundRingByUidKey(uidKey) {
  const key = String(uidKey || "");
  if (!key) return false;
  const state = readRaw();
  const nextRings = state.rings.filter((ring) => ring.uidKey !== key);
  if (nextRings.length === state.rings.length) return false;
  writeRaw({ rings: nextRings });
  if (getActiveRingUidKey() === key) {
    setActiveRingUidKey(nextRings[0]?.uidKey || "");
  }
  return true;
}

export function removeBoundRingByCloudId(cloudRingId) {
  const id = String(cloudRingId || "");
  if (!id) return false;
  const state = readRaw();
  const target = state.rings.find((ring) => ring.cloudRingId === id);
  if (!target) return false;
  return removeBoundRingByUidKey(target.uidKey);
}

export const RING_COLOR_OPTIONS = [
  { key: "gold", hex: "#d9a67a" },
  { key: "rose", hex: "#c97b84" },
  { key: "sage", hex: "#7d9e85" },
  { key: "sky", hex: "#7aa3c9" },
  { key: "lavender", hex: "#9b8fc2" },
];

export const RING_ICON_OPTIONS = ["💍", "✨", "🔐", "🧳", "💛", "🌿"];
