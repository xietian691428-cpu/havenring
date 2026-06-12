/**
 * Client **Seal with Ring** state: session arm (`lib/seal-flow`), pending draft ids,
 * `/start` SDM resolve payload shaping, finalize precheck/commit.
 */

import {
  armSealFlowWithPersistence,
  clearSealFlowArm,
  getArmedSealDraftIds,
  getArmedSealStagingId,
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
import { resolvePlatformTarget } from "../../hooks/usePlatformTarget";
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
import {
  deleteSealStaging,
  fetchSealStagingPayloads,
  uploadSealStaging,
} from "./sealStagingClient";
import { getSealStrategy, type SealTransportMode } from "./sealPlatform";
import {
  SEAL_LOCAL_MAX_BYTES,
  resolveSealStagingPlaintextMaxBytes,
} from "@/lib/seal-staging-shared";
import {
  assertDraftFitsSealBudget,
  buildSealPayloadFromDraft,
  toServerSealCommitPayload,
} from "./sealMediaPrep";
import {
  clearSealPrepBundle,
  readSealPrepRelay,
  writeSealPrepBundle,
} from "./sealPrepBundle";
import {
  SEAL_DRAFT_NOT_FOUND,
  SEAL_SESSION_ENDED,
  SEAL_STAGING_UNAVAILABLE,
} from "./sealUserMessages";

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
export { getArmedSealStagingId } from "../../../lib/seal-flow";

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

export function syncSealPrepWithSessionArm() {
  if (typeof window === "undefined") return;
  if (isSealFlowArmed()) return;
  clearPendingSealDraftIds();
}

function scheduleStagingCleanup(stagingId: string | null, accessToken?: string) {
  const id = String(stagingId || "").trim();
  if (!id || !accessToken) return;
  void deleteSealStaging(id, accessToken);
}

/** Drops session arm + pending draft id list when abandoning composer prep. */
export function clearSealPrepState(accessToken?: string) {
  const stagingId = getArmedSealStagingId();
  clearPendingSealDraftIds();
  clearSealDraftRelay();
  clearSealPrepBundle();
  clearSealFlowArm();
  scheduleStagingCleanup(stagingId, accessToken);
}

export async function sealPayloadFromDraftItem(
  item: Awaited<ReturnType<typeof getDraftItem>>,
  opts: { forStaging?: boolean; isPlus?: boolean } = {}
): Promise<SealDraftFinalizePayload | null> {
  if (!item) return null;
  return buildSealPayloadFromDraft(item, {
    maxBytes: opts.forStaging
      ? resolveSealStagingPlaintextMaxBytes(Boolean(opts.isPlus))
      : SEAL_LOCAL_MAX_BYTES,
  });
}

async function payloadsFromLocalSources(
  draftIds: string[]
): Promise<SealDraftFinalizePayload[]> {
  const payloads: SealDraftFinalizePayload[] = [];
  for (const id of draftIds) {
    const fromIdb = await sealPayloadFromDraftItem(await getDraftItem(id));
    if (fromIdb) {
      payloads.push(fromIdb);
      continue;
    }
    const relay = readSealPrepRelay(id) ?? readSealDraftRelay(id);
    if (relay) {
      payloads.push(relay);
    }
  }
  return payloads;
}

export async function collectDraftPayloadsForSeal(
  draftIds: string[],
  accessToken?: string
): Promise<SealDraftFinalizePayload[]> {
  const local = await payloadsFromLocalSources(draftIds);
  if (local.length === draftIds.length) {
    return local;
  }

  const stagingId = getArmedSealStagingId();
  if (stagingId && accessToken) {
    try {
      const staged = await fetchSealStagingPayloads({
        stagingId,
        accessToken,
        expectedDraftIds: draftIds,
      });
      if (staged.length === draftIds.length) {
        return staged;
      }
    } catch {
      /* fall through */
    }
  }

  return local;
}

async function persistSealedDraftsLocally(
  draftIds: string[],
  sealedPayloads?: SealDraftFinalizePayload[]
) {
  const now = Date.now();
  const byId = new Map(
    (sealedPayloads || []).map((row) => [String(row.id), row])
  );
  for (const id of draftIds) {
    const localItem = await getDraftItem(id);
    const staged = byId.get(id);
    const relay =
      !localItem && !staged
        ? readSealPrepRelay(id) ?? readSealDraftRelay(id)
        : null;
    const source = localItem ?? staged ?? relay;
    if (!source) continue;
    const payload = {
      id: source.id || id,
      title: String(source.title || "").trim() || "Untitled memory",
      story: String(source.story || ""),
      photo:
        Array.isArray(localItem?.photo) && localItem.photo.length
          ? localItem.photo
          : Array.isArray(source.photo) && source.photo.length
            ? source.photo
            : null,
      voice: null,
      attachments: Array.isArray(localItem?.attachments)
        ? localItem.attachments
        : Array.isArray(source.attachments)
          ? source.attachments
          : [],
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

export async function finalizeSealWithTicket(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  const { sealTicket, draftIds, accessToken } = opts;
  if (!sealTicket || !draftIds.length || !accessToken) {
    throw new Error("Missing seal confirmation data.");
  }

  ensureBrowserOnlineForSealFinalize();

  if (!isSealFlowArmed()) {
    throw new Error(SEAL_SESSION_ENDED);
  }

  let draftPayloads = await collectDraftPayloadsForSeal(draftIds, accessToken);

  const platform = resolvePlatformTarget();
  const strategy = getSealStrategy(platform);

  if (
    draftPayloads.length !== draftIds.length &&
    strategy.stagingFallbackOnFinalize &&
    strategy.stagingApiEnabled
  ) {
    const item = await getDraftItem(draftIds[0]);
    const payload = await sealPayloadFromDraftItem(item, { forStaging: true });
    if (payload) {
      const stagingId = await uploadSealStaging({
        draftIds,
        payloads: [payload],
        accessToken,
      });
      armSealFlowWithPersistence(draftIds, { stagingId });
      draftPayloads = await collectDraftPayloadsForSeal(draftIds, accessToken);
    }
  }

  if (draftPayloads.length !== draftIds.length) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
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

  const serverPayloads = draftPayloads.map(toServerSealCommitPayload);

  let commitRes: Response;
  try {
    commitRes = await fetch("/api/seal/finalize", {
      method: "POST",
      headers,
      body: JSON.stringify({
        seal_ticket: sealTicket,
        draft_ids: draftIds,
        mode: "commit",
        draft_payloads: serverPayloads,
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

  await persistSealedDraftsLocally(draftIds, draftPayloads);
  await Promise.all(draftIds.map((id) => removeDraftItem(id)));
  clearComposerSnapshot();
  scheduleStagingCleanup(getArmedSealStagingId(), accessToken);
}

export const SEAL_STEP_UP_REQUIRED = "SEAL_STEP_UP_REQUIRED";

export type PrepareSealForRingTapResult = {
  mode: SealTransportMode;
  stagingId?: string;
};

/**
 * Platform-aware seal prep: iOS/ephemeral → encrypted staging; Android → local + relay fallback.
 */
export async function prepareSealForRingTap(opts: {
  draftId: string;
  accessToken: string;
  forceStaging?: boolean;
  isPlus?: boolean;
}): Promise<PrepareSealForRingTapResult> {
  const id = String(opts.draftId || "").trim();
  if (!id) {
    throw new Error("Missing draft.");
  }
  if (!opts.accessToken) {
    throw new Error("Sign in to seal with your ring.");
  }

  clearSealCompleteRelay();
  clearSealWaitTabActive();
  clearSealNfcTapHref();

  const ids = [id];
  const item = await getDraftItem(id);
  const payload = await sealPayloadFromDraftItem(item);
  if (!payload) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }
  const isPlus = Boolean(opts.isPlus);
  const platform = resolvePlatformTarget();
  const strategy = getSealStrategy(platform, {
    forceStaging: opts.forceStaging,
  });

  await assertDraftFitsSealBudget(item, {
    forStaging: strategy.stagingOnPrep,
    isPlus,
  });

  const stagingPayload = await sealPayloadFromDraftItem(item, {
    forStaging: true,
    isPlus,
  });
  if (!stagingPayload) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }

  let stagingId: string | undefined;
  if (strategy.stagingOnPrep) {
    if (!strategy.stagingApiEnabled) {
      throw new Error(SEAL_STAGING_UNAVAILABLE);
    }
    stagingId = await uploadSealStaging({
      draftIds: ids,
      payloads: [stagingPayload],
      accessToken: opts.accessToken,
      isPlus,
    });
  }

  const relayPayload = strategy.stagingOnPrep ? stagingPayload : payload;
  writePendingSealDraftIds(ids);
  armSealFlowWithPersistence(ids, { stagingId });
  writeSealDraftRelay(relayPayload);
  writeSealPrepBundle({ draftIds: ids, relay: relayPayload });

  return { mode: strategy.transport, stagingId };
}

/** @deprecated Use `prepareSealForRingTap`. */
export async function primeSealPrepAfterDraftPersisted(
  draftId: string,
  accessToken?: string
) {
  if (!accessToken) {
    const id = String(draftId || "").trim();
    if (!id) return;
    clearSealCompleteRelay();
    clearSealWaitTabActive();
    clearSealNfcTapHref();
    const ids = [id];
    writePendingSealDraftIds(ids);
    armSealFlowWithPersistence(ids);
    const payload = await sealPayloadFromDraftItem(await getDraftItem(id));
    if (payload) {
      writeSealDraftRelay(payload);
      writeSealPrepBundle({ draftIds: ids, relay: payload });
    }
    return;
  }
  await prepareSealForRingTap({ draftId, accessToken });
}

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
  const stagingId = getArmedSealStagingId();
  const context = pending.length ? SEAL_SDM_CONTEXT : "";
  return {
    context,
    draft_ids: pending,
    ...(stagingId ? { staging_id: stagingId } : {}),
  };
}

export function abandonInProgressSealOnStartPage() {
  clearSealPrepState();
}

export async function finalizeSealChainFromSdmResponse(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  await finalizeSealWithTicket(opts);
  requestStoragePersistenceFromUserGesture();
  const stagingId = getArmedSealStagingId();
  clearSealPrepState(opts.accessToken);
  if (stagingId && opts.accessToken) {
    scheduleStagingCleanup(stagingId, opts.accessToken);
  }
  clearSealWaitTabActive();
  broadcastSealComplete();
  if (typeof window !== "undefined") {
    window.location.assign(SEAL_SUCCESS_PATH);
  }
}
