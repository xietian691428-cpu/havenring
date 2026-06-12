/**
 * Consolidated seal prep handoff (pending draft ids + relay payloads).
 * Replaces separate pending-id + relay writes for cross-tab recovery.
 */

import { SEAL_ARM_TTL_MS } from "@/lib/seal-flow";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { MAX_SEAL_DRAFT_IDS } from "./sealTypes";
import type { SealDraftFinalizePayload } from "./sealTypes";

const BUNDLE_KEY = STORAGE_KEYS.sealPrepBundle;

type SealPrepBundle = {
  expiresAt: number;
  draftIds: string[];
  relays: Record<string, SealDraftFinalizePayload>;
};

function emptyBundle(): SealPrepBundle {
  return { expiresAt: 0, draftIds: [], relays: {} };
}

function readBundle(): SealPrepBundle {
  if (typeof window === "undefined") return emptyBundle();
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      const raw = storage.getItem(BUNDLE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Partial<SealPrepBundle>;
      if (typeof parsed.expiresAt !== "number") continue;
      if (Date.now() > parsed.expiresAt) continue;
      return {
        expiresAt: parsed.expiresAt,
        draftIds: Array.isArray(parsed.draftIds)
          ? parsed.draftIds
              .map((id) => String(id || "").trim())
              .filter(Boolean)
              .slice(0, MAX_SEAL_DRAFT_IDS)
          : [],
        relays:
          parsed.relays && typeof parsed.relays === "object" ? parsed.relays : {},
      };
    } catch {
      continue;
    }
  }
  return emptyBundle();
}

function writeBundle(bundle: SealPrepBundle): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(bundle);
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      storage.setItem(BUNDLE_KEY, json);
      return;
    } catch {
      /* try next */
    }
  }
}

export function writeSealPrepBundle(opts: {
  draftIds: string[];
  relay?: SealDraftFinalizePayload | null;
}): void {
  const draftIds = opts.draftIds
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SEAL_DRAFT_IDS);
  const bundle = readBundle();
  bundle.expiresAt = Date.now() + SEAL_ARM_TTL_MS;
  bundle.draftIds = draftIds.length ? draftIds : bundle.draftIds;
  if (opts.relay?.id) {
    bundle.relays[opts.relay.id] = opts.relay;
  }
  writeBundle(bundle);
}

export function readSealPrepRelay(id: string): SealDraftFinalizePayload | null {
  const key = String(id || "").trim();
  if (!key) return null;
  const bundle = readBundle();
  if (Date.now() > bundle.expiresAt) {
    clearSealPrepBundle();
    return null;
  }
  return bundle.relays[key] ?? null;
}

export function readSealPrepDraftIds(): string[] {
  const bundle = readBundle();
  if (Date.now() > bundle.expiresAt) return [];
  return bundle.draftIds;
}

export function clearSealPrepBundle(): void {
  if (typeof window === "undefined") return;
  for (const storage of [window.localStorage, window.sessionStorage] as const) {
    try {
      storage.removeItem(BUNDLE_KEY);
    } catch {
      /* ignore */
    }
  }
}
