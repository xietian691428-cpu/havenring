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
import {
  countDisplayablePhotos,
  normalizePhotosForStorage,
} from "@/lib/memory-photo-display";
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
  userMessageFromFinalizeResponse,
  type SealFinalizeResponseBody,
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
} from "./sealDraftRelay";
import {
  deleteSealStaging,
  fetchSealStagingPayloads,
  tryUploadSealStaging,
} from "./sealStagingClient";
import { getSealStrategy, type SealTransportMode } from "./sealPlatform";
import {
  SEAL_LOCAL_MAX_BYTES,
  resolveSealStagingPlaintextMaxBytes,
} from "@/lib/seal-staging-shared";
import {
  assertDraftFitsLocalPersistBudget,
  buildSealPayloadFromDraft,
  buildSealStagingHandoffPayload,
  toServerSealCommitPayload,
} from "./sealMediaPrep";
import {
  createComposerPhotoFromBlob,
  prepareComposerPhotosForSave,
  type ComposerPhotoRow,
} from "@/lib/composer-photo-utils";
import { isMemoryPhotoRef } from "@/lib/memory-photo-types";
import {
  clearSealPrepBundle,
  readSealPrepRelay,
} from "./sealPrepBundle";
import { persistSealLocalRelay } from "./sealLocalRelay";
import {
  SEAL_DRAFT_NOT_FOUND,
  SEAL_SESSION_ENDED,
  SEAL_STAGING_UNAVAILABLE,
} from "./sealUserMessages";
import { releaseAllTimelineThumbUrls } from "@/lib/timeline-thumb-cache";
import { photoPayloadHasLargeBlob } from "@/lib/timeline-large-media";
import {
  logPostSealMemoryPressure,
  markPostSealComplete,
} from "@/lib/post-seal-memory-guard";
import {
  dequeueSealFinalize,
  enqueueSealFinalize,
  flushOfflineSyncQueue,
} from "../../services/offlineSyncQueue";

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
  const forStaging = Boolean(opts.forStaging);
  return buildSealPayloadFromDraft(item, {
    maxBytes: forStaging
      ? resolveSealStagingPlaintextMaxBytes(Boolean(opts.isPlus))
      : SEAL_LOCAL_MAX_BYTES,
    skipMediaFit: !forStaging,
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Blob-first persist path — avoids holding full JSON + base64 in heap during seal. */
async function resolveSealPersistPhotos(photo: unknown): Promise<unknown> {
  const rows = Array.isArray(photo) ? photo : photo ? [photo] : [];
  if (!rows.length) return null;

  const hasRefOnly = rows.every(
    (row) => row && typeof row === "object" && isMemoryPhotoRef(row)
  );
  if (hasRefOnly) return photo;

  const composerRows: ComposerPhotoRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const typed = row as ComposerPhotoRow & { dataUrl?: string };
    if (typed.blob instanceof Blob) {
      composerRows.push({
        id: String(typed.id || crypto.randomUUID()),
        name: typed.name,
        mimeType: typed.mimeType,
        size: typed.size,
        blob: typed.blob,
      });
      continue;
    }
    if (typeof typed.dataUrl === "string" && typed.dataUrl) {
      const blob = await dataUrlToBlob(typed.dataUrl);
      composerRows.push(
        createComposerPhotoFromBlob(blob, String(typed.id || crypto.randomUUID()))
      );
      continue;
    }
    if (isMemoryPhotoRef(row)) {
      return photo;
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 0);
    });
  }

  if (!composerRows.length) return photo;
  const prepared = await prepareComposerPhotosForSave(composerRows);
  return prepared.length ? prepared : photo;
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

function mergeSealPayloadsPreferLocal(
  staged: SealDraftFinalizePayload[],
  local: SealDraftFinalizePayload[],
  draftIds: string[]
): SealDraftFinalizePayload[] {
  const localById = new Map(local.map((row) => [String(row.id), row]));
  const stagedById = new Map(staged.map((row) => [String(row.id), row]));
  const mediaScore = (row: SealDraftFinalizePayload | undefined) => {
    if (!row) return 0;
    return (
      countDisplayablePhotos(row.photo) +
      (Array.isArray(row.attachments) ? row.attachments.length : 0)
    );
  };
  return draftIds
    .map((id) => {
      const loc = localById.get(id);
      const st = stagedById.get(id);
      if (!loc) return st;
      if (!st) return loc;
      return mediaScore(loc) >= mediaScore(st) ? loc : st;
    })
    .filter((row): row is SealDraftFinalizePayload => Boolean(row));
}

export async function collectDraftPayloadsForSeal(
  draftIds: string[],
  accessToken?: string
): Promise<SealDraftFinalizePayload[]> {
  const local = await payloadsFromLocalSources(draftIds);
  if (local.length === draftIds.length) {
    return local;
  }

  const online =
    typeof navigator === "undefined" || navigator.onLine !== false;
  if (!online) {
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
        if (local.length) {
          return mergeSealPayloadsPreferLocal(staged, local, draftIds);
        }
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
  sealedPayloads?: SealDraftFinalizePayload[],
  opts: { locallySealedAt?: number; serverSealedAt?: number } = {}
) {
  const now = Date.now();
  const locallySealedAt = Number(opts.locallySealedAt || now) || now;
  const serverSealedAt = Number(opts.serverSealedAt || 0) || undefined;
  const ring = getActiveRingOrFirst();
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
    const stagedPhotos = normalizePhotosForStorage(staged?.photo);
    const localPhotos = normalizePhotosForStorage(localItem?.photo);
    const sourcePhotos = normalizePhotosForStorage(source.photo);
    const rawPhoto =
      stagedPhotos && countDisplayablePhotos(stagedPhotos) > 0
        ? stagedPhotos
        : localPhotos && countDisplayablePhotos(localPhotos) > 0
          ? localPhotos
          : sourcePhotos;
    const photo =
      localItem?.photo && Array.isArray(localItem.photo) && localItem.photo.length
        ? await resolveSealPersistPhotos(localItem.photo)
        : await resolveSealPersistPhotos(rawPhoto);
    const payload = {
      id: source.id || id,
      title: String(source.title || "").trim() || "Untitled memory",
      story: String(source.story || ""),
      photo,
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
      coreLocked: true,
      pairShared: true,
      locallySealedAt,
      serverSealedAt,
      ring_id: ring?.cloudRingId ?? null,
      haven_id: ring?.havenId ?? null,
    };
    const existing = await getMemoryById(id);
    let saved;
    if (existing) {
      saved = await saveMemory(
        { ...existing, ...payload },
        { allowCoreEdit: true }
      );
    } else {
      await createMemory(payload);
      saved = { id };
    }
    const stored = await getMemoryById(saved.id || id);
    if (stored) {
      const { backupPairMemoryToCloud } = await import(
        "../../services/pairSharingService.js"
      );
      void backupPairMemoryToCloud(stored);
    }
  }
  markFirstMemoryCompleted();
  if (ring?.uidKey && draftIds.length) {
    try {
      await clearRingSyncQueue(ring.uidKey, draftIds);
    } catch (error) {
      console.warn("[haven-ring] ring sync queue clear skipped after seal:", error);
    }
  }
}

/** Phase 1: local encrypt + IDB (+ sidecar) before any server finalize. */
export async function persistSealedDraftsLocallyFirst(
  draftIds: string[],
  sealedPayloads: SealDraftFinalizePayload[]
) {
  const locallySealedAt = Date.now();
  await persistSealedDraftsLocally(draftIds, sealedPayloads, { locallySealedAt });
  await Promise.all(draftIds.map((id) => removeDraftItem(id)));
  clearComposerSnapshot();
}

async function markMemoriesServerSealed(draftIds: string[]) {
  const serverSealedAt = Date.now();
  for (const id of draftIds) {
    const existing = await getMemoryById(id);
    if (!existing) continue;
    await saveMemory(
      { ...existing, serverSealedAt },
      { allowCoreEdit: true }
    );
  }
}

export type CommitServerSealFinalizeOptions = FinalizeSealWithTicketOptions & {
  draftPayloads: SealDraftFinalizePayload[];
};

/** Server audit only — local memory must already exist. */
export async function commitServerSealFinalize(
  opts: CommitServerSealFinalizeOptions
): Promise<void> {
  const { sealTicket, draftIds, accessToken, draftPayloads } = opts;
  if (!sealTicket || !draftIds.length || !accessToken) {
    throw new Error("Missing seal confirmation data.");
  }
  if (draftPayloads.length !== draftIds.length) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const precheckRes = await fetch("/api/seal/finalize", {
    method: "POST",
    headers,
    body: JSON.stringify({
      seal_ticket: sealTicket,
      draft_ids: draftIds,
      mode: "precheck",
    }),
  });
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
  const commitRes = await fetch("/api/seal/finalize", {
    method: "POST",
    headers,
    body: JSON.stringify({
      seal_ticket: sealTicket,
      draft_ids: draftIds,
      mode: "commit",
      draft_payloads: serverPayloads,
    }),
  });
  const commitJson =
    ((await commitRes.json().catch(() => ({}))) as SealFinalizeResponseBody);
  if (!commitRes.ok || commitJson?.ok !== true) {
    throw new Error(
      userMessageFromFinalizeResponse(commitJson, "Seal could not be completed.")
    );
  }

  await markMemoriesServerSealed(draftIds);
  await dequeueSealFinalize(draftIds);
}

async function scheduleServerSealFinalize(opts: CommitServerSealFinalizeOptions) {
  await enqueueSealFinalize({
    sealTicket: opts.sealTicket,
    draftIds: opts.draftIds,
    localCommitted: true,
    draftPayloads: opts.draftPayloads,
  });
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await commitServerSealFinalize(opts);
  } catch (error) {
    console.warn("[haven-ring] server seal finalize deferred:", error);
    void flushOfflineSyncQueue(opts.accessToken);
  }
}

/** Legacy network-first path for pre-Phase-1 queue items only. */
export async function finalizeSealWithTicketNetworkFirst(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  const { sealTicket, draftIds, accessToken } = opts;
  if (!sealTicket || !draftIds.length || !accessToken) {
    throw new Error("Missing seal confirmation data.");
  }

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
    if (item) {
      const handoffPayload = buildSealStagingHandoffPayload(item);
      const stagingId = await tryUploadSealStaging({
        draftIds,
        payloads: [handoffPayload],
        accessToken,
      });
      if (stagingId) {
        armSealFlowWithPersistence(draftIds, { stagingId });
        draftPayloads = await collectDraftPayloadsForSeal(draftIds, accessToken);
      }
    }
  }

  if (draftPayloads.length !== draftIds.length) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }

  await commitServerSealFinalize({
    sealTicket,
    draftIds,
    accessToken,
    draftPayloads,
  });
  const sealedAt = Date.now();
  await persistSealedDraftsLocally(draftIds, draftPayloads, {
    locallySealedAt: sealedAt,
    serverSealedAt: sealedAt,
  });
  await Promise.all(draftIds.map((id) => removeDraftItem(id)));
  clearComposerSnapshot();
  scheduleStagingCleanup(getArmedSealStagingId(), accessToken);
}

/** @deprecated Use local-first `finalizeSealChainFromSdmResponse`. Server commit only. */
export async function finalizeSealWithTicket(
  opts: FinalizeSealWithTicketOptions
): Promise<void> {
  const payloads = await collectDraftPayloadsForSeal(opts.draftIds, opts.accessToken);
  if (payloads.length !== opts.draftIds.length) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }
  await commitServerSealFinalize({ ...opts, draftPayloads: payloads });
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
  if (!item) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }
  const payload = await sealPayloadFromDraftItem(item);
  if (!payload) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }
  const isPlus = Boolean(opts.isPlus);
  const platform = resolvePlatformTarget();
  const strategy = getSealStrategy(platform, {
    forceStaging: opts.forceStaging,
  });

  await assertDraftFitsLocalPersistBudget(item, isPlus);

  writePendingSealDraftIds(ids);
  armSealFlowWithPersistence(ids);
  persistSealLocalRelay(ids, payload);

  let stagingId: string | undefined;
  if (strategy.stagingOnPrep) {
    if (!strategy.stagingApiEnabled) {
      throw new Error(SEAL_STAGING_UNAVAILABLE);
    }
    const handoffPayload = buildSealStagingHandoffPayload(item);
    stagingId = await tryUploadSealStaging({
      draftIds: ids,
      payloads: [handoffPayload],
      accessToken: opts.accessToken,
      isPlus,
    });
    if (stagingId) {
      armSealFlowWithPersistence(ids, { stagingId });
    }
  }

  return { mode: stagingId ? strategy.transport : "local", stagingId };
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
      persistSealLocalRelay(ids, payload);
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
  const { sealTicket, draftIds, accessToken } = opts;
  if (!sealTicket || !draftIds.length || !accessToken) {
    throw new Error("Missing seal confirmation data.");
  }

  if (!isSealFlowArmed()) {
    throw new Error(SEAL_SESSION_ENDED);
  }

  let draftPayloads = await collectDraftPayloadsForSeal(draftIds, accessToken);

  const platform = resolvePlatformTarget();
  const strategy = getSealStrategy(platform);
  const online = typeof navigator === "undefined" || navigator.onLine !== false;

  if (
    online &&
    draftPayloads.length !== draftIds.length &&
    strategy.stagingFallbackOnFinalize &&
    strategy.stagingApiEnabled
  ) {
    const item = await getDraftItem(draftIds[0]);
    if (item) {
      const handoffPayload = buildSealStagingHandoffPayload(item);
      const stagingId = await tryUploadSealStaging({
        draftIds,
        payloads: [handoffPayload],
        accessToken,
      });
      if (stagingId) {
        armSealFlowWithPersistence(draftIds, { stagingId });
        draftPayloads = await collectDraftPayloadsForSeal(draftIds, accessToken);
      }
    }
  }

  if (draftPayloads.length !== draftIds.length) {
    throw new Error(SEAL_DRAFT_NOT_FOUND);
  }

  await persistSealedDraftsLocallyFirst(draftIds, draftPayloads);

  const hasLargeMedia = draftPayloads.some((row) =>
    photoPayloadHasLargeBlob(row.photo)
  );
  releaseAllTimelineThumbUrls();
  markPostSealComplete({ hasLargeMedia });
  logPostSealMemoryPressure();

  const stagingId = getArmedSealStagingId();
  requestStoragePersistenceFromUserGesture();
  clearSealPrepState(accessToken);
  if (stagingId && accessToken) {
    scheduleStagingCleanup(stagingId, accessToken);
  }
  clearSealWaitTabActive();
  broadcastSealComplete();

  void scheduleServerSealFinalize({
    sealTicket,
    draftIds,
    accessToken,
    draftPayloads,
  });

  if (typeof window !== "undefined") {
    window.location.assign(SEAL_SUCCESS_PATH);
  }
}
