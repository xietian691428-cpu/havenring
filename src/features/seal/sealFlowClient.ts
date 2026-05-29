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

export function readPendingSealDraftIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_SEAL_DRAFT_IDS_KEY) || "[]"
    );
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

export function writePendingSealDraftIds(ids: string[] = []) {
  if (typeof window === "undefined") return;
  if (!ids.length) {
    window.localStorage.removeItem(PENDING_SEAL_DRAFT_IDS_KEY);
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
}

export function clearPendingSealDraftIds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_SEAL_DRAFT_IDS_KEY);
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

export async function collectDraftPayloadsForSeal(
  draftIds: string[]
): Promise<SealDraftFinalizePayload[]> {
  const payloads: SealDraftFinalizePayload[] = [];
  for (const id of draftIds) {
    const item = await getDraftItem(id);
    if (!item) continue;
    const photo = slimMediaForSealFinalize(
      Array.isArray(item.photo) ? item.photo : []
    );
    const attachments = slimMediaForSealFinalize(
      Array.isArray(item.attachments) ? item.attachments : []
    );
    payloads.push({
      id,
      title: String(item.title || "Untitled memory"),
      story: String(item.story || ""),
      photo,
      attachments,
      releaseAt: Number(item.releaseAt || 0) || 0,
    });
  }
  return payloads;
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

  const draftPayloads = await collectDraftPayloadsForSeal(draftIds);
  if (draftPayloads.length !== draftIds.length) {
    throw new Error(
      "Your saved draft could not be found. Return to the memory page and try again."
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

  await Promise.all(draftIds.map((id) => removeDraftItem(id)));
}

/** Called after composing & persisting draft to idb, before prompting for ring tap. */
export function primeSealPrepAfterDraftPersisted(draftId: string) {
  const id = String(draftId || "").trim();
  if (!id) return;
  const ids = [id];
  writePendingSealDraftIds(ids);
  armSealFlowWithPersistence(ids);
}

/** SDM resolver body fields on `/start` when the seal arm window is active (cross-tab safe). */
export function getSealSdmContextPayload(): SealSdmContextPayload {
  if (!isSealFlowArmed()) {
    const pendingOnly = readPendingSealDraftIds();
    if (pendingOnly.length) {
      armSealFlowWithPersistence(pendingOnly);
    } else {
      syncSealPrepWithSessionArm();
      return { context: "", draft_ids: [] };
    }
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
  if (typeof window !== "undefined") {
    window.location.assign(SEAL_SUCCESS_PATH);
  }
}
