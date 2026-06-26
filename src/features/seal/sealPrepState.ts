/**
 * Lightweight seal prep state (pending draft ids, session arm cleanup).
 * Kept separate from sealFlowClient so /start idle and session boundary avoid heavy seal imports.
 */

import { clearSealFlowArm, getArmedSealStagingId, isSealFlowArmed } from "@/lib/seal-flow";
import { clearSealDraftRelay } from "./sealDraftRelay";
import { clearSealPrepBundle } from "./sealPrepBundle";
import { MAX_SEAL_DRAFT_IDS, PENDING_SEAL_DRAFT_IDS_KEY } from "./sealTypes";

const PENDING_SEAL_DRAFT_IDS_COOKIE = "haven_pending_seal_draft_ids_v1";

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
  const parts = document.cookie ? document.cookie.split(";") : [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  }
  return null;
}

function readPendingSealDraftIdsCookie(): string[] {
  try {
    const raw = readCookie(PENDING_SEAL_DRAFT_IDS_COOKIE);
    if (!raw) return [];
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed)
      ? parsed
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .slice(0, MAX_SEAL_DRAFT_IDS)
      : [];
  } catch {
    return [];
  }
}

function writePendingSealDraftIdsCookie(ids: string[]) {
  if (typeof document === "undefined") return;
  try {
    if (!ids.length) {
      document.cookie = `${PENDING_SEAL_DRAFT_IDS_COOKIE}=; ${sealCookieOptions(0)}`;
      return;
    }
    document.cookie = `${PENDING_SEAL_DRAFT_IDS_COOKIE}=${encodeURIComponent(
      JSON.stringify(ids)
    )}; ${sealCookieOptions(5 * 60)}`;
  } catch {
    /* ignore */
  }
}

export function readPendingSealDraftIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_SEAL_DRAFT_IDS_KEY) || "[]"
    );
    const ids = Array.isArray(parsed)
      ? parsed
          .map((id) => String(id || "").trim())
          .filter(Boolean)
          .slice(0, MAX_SEAL_DRAFT_IDS)
      : [];
    if (ids.length) return ids;
  } catch {
    /* fall through to cookie */
  }
  return readPendingSealDraftIdsCookie();
}

export function writePendingSealDraftIds(ids: string[] = []) {
  if (typeof window === "undefined") return;
  if (!ids.length) {
    window.localStorage.removeItem(PENDING_SEAL_DRAFT_IDS_KEY);
    writePendingSealDraftIdsCookie([]);
    return;
  }
  const normalized = ids
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SEAL_DRAFT_IDS);
  window.localStorage.setItem(
    PENDING_SEAL_DRAFT_IDS_KEY,
    JSON.stringify(normalized)
  );
  writePendingSealDraftIdsCookie(normalized);
}

export function clearPendingSealDraftIds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_SEAL_DRAFT_IDS_KEY);
  writePendingSealDraftIdsCookie([]);
}

export function syncSealPrepWithSessionArm() {
  if (typeof window === "undefined") return;
  if (isSealFlowArmed()) return;
  clearPendingSealDraftIds();
}

/** Clears local seal prep without loading staging client. */
export function clearSealPrepStateLocal(): void {
  clearPendingSealDraftIds();
  clearSealDraftRelay();
  clearSealPrepBundle();
  clearSealFlowArm();
}

function scheduleStagingCleanup(stagingId: string | null, accessToken?: string) {
  const id = String(stagingId || "").trim();
  if (!id || !accessToken) return;
  void import("./sealStagingClient").then((mod) => {
    void mod.deleteSealStaging(id, accessToken);
  });
}

/** Drops session arm + pending draft id list when abandoning composer prep. */
export function clearSealPrepState(accessToken?: string) {
  const stagingId = getArmedSealStagingId();
  clearSealPrepStateLocal();
  scheduleStagingCleanup(stagingId, accessToken);
}

export function hasPendingSealDrafts(): boolean {
  return readPendingSealDraftIds().length > 0;
}

export function shouldMountSealSessionListeners(): boolean {
  if (typeof window === "undefined") return false;
  return isSealFlowArmed() || hasPendingSealDrafts();
}
