/**
 * Cross-tab seal draft relay for iOS Safari (especially Private Browsing).
 * NFC opens a new tab that often cannot read IndexedDB drafts from the composer tab;
 * pending draft ids in localStorage still arrive, so we mirror finalize payloads here.
 */

import { SEAL_STAGING_MAX_BYTES } from "@/lib/seal-staging-shared";
import { SEAL_ARM_TTL_MS } from "@/lib/seal-flow";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { readSealPrepRelay } from "./sealPrepBundle";
import type { SealDraftFinalizePayload } from "./sealTypes";

const RELAY_KEY = STORAGE_KEYS.sealDraftRelay;
const TEXT_COOKIE = "haven_seal_text_relay_v1";
const MAX_RELAY_BYTES = SEAL_STAGING_MAX_BYTES;

type RelayStore = {
  expiresAt: number;
  byId: Record<string, SealDraftFinalizePayload>;
};

function sealCookieOptions(maxAgeSeconds: number): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie ? document.cookie.split(";") : []) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return null;
}

function emptyStore(): RelayStore {
  return { expiresAt: 0, byId: {} };
}

function readRelayStore(): RelayStore {
  if (typeof window === "undefined") return emptyStore();
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      const raw = storage.getItem(RELAY_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<RelayStore>;
      if (typeof parsed.expiresAt !== "number" || !parsed.byId) continue;
      if (Date.now() > parsed.expiresAt) continue;
      return { expiresAt: parsed.expiresAt, byId: parsed.byId };
    } catch {
      continue;
    }
  }
  return emptyStore();
}

function slimRelayPayload(
  payload: SealDraftFinalizePayload,
  maxBytes: number
): SealDraftFinalizePayload {
  const base = {
    id: payload.id,
    title: payload.title,
    story: payload.story,
    photo: [] as unknown[],
    attachments: [] as unknown[],
    releaseAt: payload.releaseAt,
  };
  let budget = maxBytes - JSON.stringify(base).length;
  const photo: unknown[] = [];
  for (const row of payload.photo) {
    const bytes = JSON.stringify(row).length;
    if (bytes > budget) break;
    photo.push(row);
    budget -= bytes;
  }
  return { ...base, photo };
}

function persistRelayStore(store: RelayStore): void {
  if (typeof window === "undefined") return;
  let json = JSON.stringify(store);
  if (json.length > MAX_RELAY_BYTES) {
    const slimmed: Record<string, SealDraftFinalizePayload> = {};
    for (const [id, row] of Object.entries(store.byId)) {
      slimmed[id] = slimRelayPayload(row, Math.floor(MAX_RELAY_BYTES / 2));
    }
    store = { ...store, byId: slimmed };
    json = JSON.stringify(store);
  }
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      storage.setItem(RELAY_KEY, json);
    } catch {
      /* quota — try text-only below */
    }
  }
  const first = Object.values(store.byId)[0];
  if (first) {
    try {
      const textOnly = JSON.stringify({
        id: first.id,
        title: first.title,
        story: first.story,
        releaseAt: first.releaseAt,
      });
      if (textOnly.length < 3500) {
        document.cookie = `${TEXT_COOKIE}=${encodeURIComponent(textOnly)}; ${sealCookieOptions(
          Math.max(1, Math.ceil((store.expiresAt - Date.now()) / 1000))
        )}`;
      }
    } catch {
      /* ignore */
    }
  }
}

function readTextCookieRelay(id: string): SealDraftFinalizePayload | null {
  try {
    const raw = readCookie(TEXT_COOKIE);
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    if (String(parsed.id || "") !== id) return null;
    return {
      id,
      title: String(parsed.title || "Untitled memory"),
      story: String(parsed.story || ""),
      photo: [],
      attachments: [],
      releaseAt: Number(parsed.releaseAt || 0) || 0,
    };
  } catch {
    return null;
  }
}

export function writeSealDraftRelay(payload: SealDraftFinalizePayload): void {
  if (typeof window === "undefined") return;
  const id = String(payload.id || "").trim();
  if (!id) return;
  const store = readRelayStore();
  store.byId[id] = payload;
  store.expiresAt = Date.now() + SEAL_ARM_TTL_MS;
  persistRelayStore(store);
}

export function readSealDraftRelay(id: string): SealDraftFinalizePayload | null {
  const key = String(id || "").trim();
  if (!key) return null;
  const fromBundle = readSealPrepRelay(key);
  if (fromBundle) return fromBundle;
  const store = readRelayStore();
  if (Date.now() > store.expiresAt) {
    clearSealDraftRelay();
    return null;
  }
  return store.byId[key] ?? readTextCookieRelay(key);
}

export function clearSealDraftRelay(): void {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      storage.removeItem(RELAY_KEY);
    } catch {
      /* ignore */
    }
  }
  try {
    document.cookie = `${TEXT_COOKIE}=; ${sealCookieOptions(0)}`;
  } catch {
    /* ignore */
  }
}
