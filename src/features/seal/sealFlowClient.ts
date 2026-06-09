/**
 * Client **Seal with Ring** state: session arm (`lib/seal-flow`), pending draft ids,
 * `/start` SDM resolve payload shaping, finalize precheck/commit.
 */

import {
  armSealFlowWithPersistence,
  clearSealFlowArm,
  getArmedSealDraftIds,
  isSealFlowArmed,
} from "../../../lib/seal-flow";
import { getDraftItem, removeDraftItem } from "../memories/draftBoxStore";
import {
  createMemory,
  getMemoryById,
  saveMemory,
} from "../../services/localStorageService";
import { markFirstMemoryCompleted } from "../../services/firstRunTelemetryService";
import { clearRingSyncQueue } from "../../services/ringScopedCacheService";
import { getActiveRingOrFirst } from "../../services/ringRegistryService";
import {
  MAX_SEAL_DRAFT_IDS,
  PENDING_SEAL_DRAFT_IDS_KEY,
  SEAL_SDM_CONTEXT,
  SEAL_SUCCESS_PATH,
  type FinalizeSealWithTicketOptions,
  type SealDraftFinalizePayload,
  type SealSdmContextPayload,
} from "./sealTypes";
import {
  ensureBrowserOnlineForSealFinalize,
  userMessageFromFinalizeResponse,
  type SealFinalizeResponseBody,
  sealFinalizeFetchFailedMessage,
} from "./sealFinalizeMessaging";
import { requestStoragePersistenceFromUserGesture } from "../../../lib/requestStoragePersistence";
import {
  broadcastSealComplete,
  clearSealCompleteRelay,
  clearSealWaitTabActive,
} from "./sealCrossTab";
import { clearSealNfcTapHref } from "./sealNfcTapRelay";
import { clearComposerSnapshot } from "./composerSnapshotSafe";
import {
  clearSealDraftRelay,
  readSealDraftRelay,
  writeSealDraftRelay,
} from "./sealDraftRelay";
import { requiresSealStepUp } from "../../services/deviceTrustService";

const PENDING_SEAL_DRAFT_IDS_COOKIE = "haven_pending_seal_draft_ids_v1";

export {
  armSealFlow,
  armSealFlowWithPersistence,
  clearSealFlowArm,
  getArmedSealDraftIds,
  isSealFlowArmed,
  getSealArmedRemainingMs,
  clearSealFlowArmIfExpired,
  readActiveSealArmedPayload,
} from "../../../lib/seal-flow";

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

/** Re-read armed payload from cross-tab storage (does not arm from orphan draft ids). */
export function syncHydrateSealPrepFromStorage(): void {
  if (typeof window === "undefined") return;
  if (isSealFlowArmed()) return;
  syncSealPrepWithSessionArm();
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

/**
 * Clears orphan pending draft ids when the seal arm window is missing or expired.
 */
export function syncSealPrepWithSessionArm() {
  if (typeof window === "undefined") return;
  if (isSealFlowArmed()) return;
  clearPendingSealDraftIds();
}

/** Drops session arm + pending draft id list /used when abandoning composer prep. */
export function clearSealPrepState() {
  clearPendingSealDraftIds();
  clearSealDraftRelay();
  clearSealFlowArm();
}

const MAX_SEAL_PAYLOAD_BYTES = 4 * 1024 * 1024;

function estimateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function slimMediaForSealFinalize(items: unknown[]): unknown[] {
  if (!Array.isArray(items)) return [];
  const slim: unknown[] = [];
  let budget = MAX_SEAL_PAYLOAD_BYTES;
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const candidate = {
      id: obj.id,
      name: obj.name,
      mimeType: obj.mimeType,
      size: obj.size,
      dataUrl: typeof obj.dataUrl === "string" ? obj.dataUrl : undefined,
    };
    const bytes = estimateJsonBytes(candidate);
    if (bytes > budget) break;
    budget -= bytes;
    slim.push(candidate);
  }
  return slim;
}

function sealPayloadFromDraftItem(
  item: Awaited<ReturnType<typeof getDraftItem>>
): SealDraftFinalizePayload | null {
  if (!item) return null;
  return {
    id: item.id,
    title: String(item.title || "Untitled memory"),
    story: String(item.story || ""),
    photo: slimMediaForSealFinalize(Array.isArray(item.photo) ? item.photo : []),
    attachments: slimMediaForSealFinalize(
      Array.isArray(item.attachments) ? item.attachments : []
    ),
    releaseAt: Number(item.releaseAt || 0) || 0,
  };
}

export async function collectDraftPayloadsForSeal(
  draftIds: string[]
): Promise<SealDraftFinalizePayload[]> {
  const payloads: SealDraftFinalizePayload[] = [];
  for (const id of draftIds) {
    const fromIdb = sealPayloadFromDraftItem(await getDraftItem(id));
    if (fromIdb) {
      payloads.push(fromIdb);
      continue;
    }
    const relay = readSealDraftRelay(id);
    if (relay) {
      payloads.push(relay);
    }
  }
  return payloads;
}

/** Timeline reads local IndexedDB; seal commit only writes Supabase until this runs. */
async function persistSealedDraftsLocally(draftIds: string[]) {
  const now = Date.now();
  for (const id of draftIds) {
    const item = await getDraftItem(id);
    const relay = !item ? readSealDraftRelay(id) : null;
    const source = item ?? relay;
    if (!source) continue;
    const payload = {
      id: source.id || id,
      title: String(source.title || "").trim() || "Untitled memory",
      story: String(source.story || ""),
      photo:
        Array.isArray(source.photo) && source.photo.length ? source.photo : null,
      voice: null,
      attachments: Array.isArray(source.attachments) ? source.attachments : [],
      timelineAt:
        Number(
          ("updatedAt" in source ? source.updatedAt : 0) ||
            ("createdAt" in source ? source.createdAt : 0) ||
            now
        ) || now,
      releaseAt: Number(source.releaseAt || 0) || 0,
      createdAt:
        Number(("createdAt" in source ? source.createdAt : 0) || now) || now,
      tags: [] as unknown[],
      is_sealed: true,
    };
    const existing = await getMemoryById(id);
    if (existing) {
      await saveMemory({ ...existing, ...payload });
    } else {
      await createMemory(payload);
    }
  }
  markFirstMemoryCompleted();
  const ring = getActiveRingOrFirst();
  if (ring?.uidKey && draftIds.length) {
    try {
      await clearRingSyncQueue(ring.uidKey, draftIds);
    } catch (error) {
      console.warn("[haven-ring] ring sync queue clear skipped after seal:", error);
    }
  }
}

/**
 * Bearer-authenticated finalize: `precheck` then `commit` with draft payloads from idb drafts.
 */
export async function finalizeSealWithTicket(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  const { sealTicket, draftIds, accessToken } = opts;
  if (!sealTicket || !draftIds.length || !accessToken) {
    throw new Error("Missing seal confirmation data.");
  }

  ensureBrowserOnlineForSealFinalize();

  if (!isSealFlowArmed()) {
    throw new Error(
      "Seal session ended. Open your draft and tap Seal with Ring again."
    );
  }

  const draftPayloads = await collectDraftPayloadsForSeal(draftIds);
  if (draftPayloads.length !== draftIds.length) {
    throw new Error(
      "Your saved draft could not be found. If you use Safari Private Browsing, switch to a normal tab or Add to Home Screen, then tap Seal with Ring again."
    );
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  let precheckRes: Response;
  try {
    precheckRes = await fetch("/api/seal/finalize", {
      method: "POST",
      headers,
      body: JSON.stringify({
        seal_ticket: sealTicket,
        draft_ids: draftIds,
        mode: "precheck",
      }),
    });
  } catch {
    throw new Error(sealFinalizeFetchFailedMessage());
  }
  const precheckJson =
    ((await precheckRes.json().catch(() => ({}))) as SealFinalizeResponseBody);
  if (!precheckRes.ok || precheckJson?.ok !== true) {
    throw new Error(
      userMessageFromFinalizeResponse(
        precheckJson,
        "Seal verification could not be completed."
      )
    );
  }

  let commitRes: Response;
  try {
    commitRes = await fetch("/api/seal/finalize", {
      method: "POST",
      headers,
      body: JSON.stringify({
        seal_ticket: sealTicket,
        draft_ids: draftIds,
        mode: "commit",
        draft_payloads: draftPayloads,
      }),
    });
  } catch {
    throw new Error(sealFinalizeFetchFailedMessage());
  }
  const commitJson =
    ((await commitRes.json().catch(() => ({}))) as SealFinalizeResponseBody);
  if (!commitRes.ok || commitJson?.ok !== true) {
    throw new Error(
      userMessageFromFinalizeResponse(commitJson, "Seal could not be completed.")
    );
  }

  await persistSealedDraftsLocally(draftIds);
  await Promise.all(draftIds.map((id) => removeDraftItem(id)));
  clearComposerSnapshot();
}

/** Called after composing & persisting draft to idb, before prompting for ring tap. */
export const SEAL_STEP_UP_REQUIRED = "SEAL_STEP_UP_REQUIRED";

export async function primeSealPrepAfterDraftPersisted(draftId: string) {
  const id = String(draftId || "").trim();
  if (!id) return;
  if (requiresSealStepUp()) {
    throw new Error(SEAL_STEP_UP_REQUIRED);
  }
  clearSealCompleteRelay();
  clearSealWaitTabActive();
  clearSealNfcTapHref();
  const ids = [id];
  writePendingSealDraftIds(ids);
  armSealFlowWithPersistence(ids);
  const payload = sealPayloadFromDraftItem(await getDraftItem(id));
  if (payload) {
    writeSealDraftRelay(payload);
  }
}

/** SDM resolver body fields on `/start` when the seal arm window is active (cross-tab safe). */
export function getSealSdmContextPayload(): SealSdmContextPayload {
  if (!isSealFlowArmed()) {
    syncSealPrepWithSessionArm();
    return { context: "", draft_ids: [] };
  }
  const fromArm = getArmedSealDraftIds();
  const pending = fromArm.length ? fromArm : readPendingSealDraftIds();
  if (fromArm.length) {
    writePendingSealDraftIds(fromArm);
  }
  const context = pending.length ? SEAL_SDM_CONTEXT : "";
  return { context, draft_ids: pending };
}

export function abandonInProgressSealOnStartPage() {
  clearSealPrepState();
}

/**
 * Run after `/api/rings/sdm/resolve` returns `seal_confirmation` + seal ticket plaintext.
 */
export async function finalizeSealChainFromSdmResponse(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  await finalizeSealWithTicket(opts);
  requestStoragePersistenceFromUserGesture();
  clearSealPrepState();
  clearSealWaitTabActive();
  broadcastSealComplete();
  if (typeof window !== "undefined") {
    window.location.assign(SEAL_SUCCESS_PATH);
  }
}
