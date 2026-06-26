/**
 * Global offline queue for Seal finalize and Pair sync retries.
 * Coordinator on main thread; network work via background-sync Worker.
 */
import { createStore, get, set } from "idb-keyval";
import { isDeferredDuringPostSealQuiet, isHeavyPostSealBackgroundBlocked } from "@/lib/post-seal-memory-guard";
import { runSealFinalizeNetwork } from "@/lib/background-sync-client";
import { toServerSealCommitPayload } from "@/src/features/seal/sealMediaPrep";
import type { SealDraftFinalizePayload } from "@/src/features/seal/sealTypes";
import { markMemoriesServerSealedLocally } from "./sealLocalFinalizeMarks";

const store = createStore("haven-offline-sync-v1", "queue");
const QUEUE_KEY = "global";
const MAX_ATTEMPTS = 5;

export type OfflineSealItem = {
  kind: "seal_finalize";
  id: string;
  sealTicket: string;
  draftIds: string[];
  /** Phase 1: local IDB write already succeeded before enqueue. */
  localCommitted?: boolean;
  draftPayloads?: SealDraftFinalizePayload[];
  queuedAt: number;
  attempts: number;
};

export type OfflinePairItem = {
  kind: "pair_sync";
  id: string;
  queuedAt: number;
  attempts: number;
};

export type OfflineQueueItem = OfflineSealItem | OfflinePairItem;

async function readQueue(): Promise<OfflineQueueItem[]> {
  const rows = await get(QUEUE_KEY, store);
  return Array.isArray(rows) ? rows : [];
}

async function writeQueue(items: OfflineQueueItem[]) {
  await set(QUEUE_KEY, items, store);
}

export { shouldQueueSealFailure } from "@/lib/user-facing-errors";

export async function enqueueSealFinalize(args: {
  sealTicket: string;
  draftIds: string[];
  localCommitted?: boolean;
  draftPayloads?: SealDraftFinalizePayload[];
}): Promise<boolean> {
  const sealTicket = String(args.sealTicket || "").trim();
  const draftIds = (args.draftIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!sealTicket || !draftIds.length) return false;

  const queue = await readQueue();
  const id = `seal:${draftIds.join(",")}`;
  const next: OfflineQueueItem[] = [
    ...queue.filter((row) => row.id !== id),
    {
      kind: "seal_finalize",
      id,
      sealTicket,
      draftIds,
      localCommitted: Boolean(args.localCommitted),
      draftPayloads: Array.isArray(args.draftPayloads) ? args.draftPayloads : undefined,
      queuedAt: Date.now(),
      attempts: 0,
    },
  ];
  await writeQueue(next);
  return true;
}

export async function dequeueSealFinalize(draftIds: string[]): Promise<void> {
  const normalized = draftIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!normalized.length) return;
  const id = `seal:${normalized.join(",")}`;
  const queue = await readQueue();
  const next = queue.filter((row) => row.id !== id);
  if (next.length !== queue.length) {
    await writeQueue(next);
  }
}

export async function enqueuePairSyncRetry(): Promise<boolean> {
  const queue = await readQueue();
  const id = "pair:sync";
  if (queue.some((row) => row.id === id)) return false;
  await writeQueue([
    ...queue,
    { kind: "pair_sync", id, queuedAt: Date.now(), attempts: 0 },
  ]);
  return true;
}

export async function countPendingSealFinalize(): Promise<number> {
  const queue = await readQueue();
  return queue.filter((row) => row.kind === "seal_finalize").length;
}

export async function readOfflineSyncQueue(): Promise<OfflineQueueItem[]> {
  return readQueue();
}

export async function flushOfflineSyncQueue(
  accessToken?: string
): Promise<{ flushed: number; remaining: number }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const pending = await readQueue();
    return { flushed: 0, remaining: pending.length };
  }

  const token = String(accessToken || "").trim();
  if (!token) {
    const pending = await readQueue();
    return { flushed: 0, remaining: pending.length };
  }

  if (isHeavyPostSealBackgroundBlocked()) {
    const pending = await readQueue();
    return { flushed: 0, remaining: pending.length };
  }

  const queue = await readQueue();
  if (!queue.length) {
    return { flushed: 0, remaining: 0 };
  }

  const { broadcastSealComplete } = await import("@/src/features/seal/sealCrossTab");

  let flushed = 0;
  const remaining: OfflineQueueItem[] = [];

  for (const item of queue) {
    const attempts = Number(item.attempts || 0);
    if (attempts >= MAX_ATTEMPTS) {
      remaining.push(item);
      continue;
    }

    if (isDeferredDuringPostSealQuiet(item)) {
      remaining.push(item);
      continue;
    }

    try {
      if (item.kind === "seal_finalize") {
        if (item.localCommitted) {
          const payloads = item.draftPayloads || [];
          if (payloads.length !== item.draftIds.length) {
            throw new Error("Missing draft payloads for server finalize.");
          }
          await runSealFinalizeNetwork({
            sealTicket: item.sealTicket,
            draftIds: item.draftIds,
            accessToken: token,
            serverPayloads: payloads.map(toServerSealCommitPayload),
          });
          await markMemoriesServerSealedLocally(item.draftIds);
          await dequeueSealFinalize(item.draftIds);
        } else {
          const { finalizeSealWithTicketNetworkFirst, clearSealPrepState } = await import(
            "@/src/features/seal/sealFlowClient"
          );
          await finalizeSealWithTicketNetworkFirst({
            sealTicket: item.sealTicket,
            draftIds: item.draftIds,
            accessToken: token,
          });
          clearSealPrepState(token);
          broadcastSealComplete();
        }
        flushed += 1;
        continue;
      }

      if (item.kind === "pair_sync") {
        const { syncPairMemoriesFromServer } = await import(
          "@/src/services/pairSharingService.js"
        );
        await syncPairMemoriesFromServer(token);
        flushed += 1;
        continue;
      }
    } catch (error) {
      console.warn("[haven-ring] offline queue flush skipped:", item.kind, error);
      remaining.push({
        ...item,
        attempts: attempts + 1,
        queuedAt: Date.now(),
      } as OfflineQueueItem);
    }
  }

  await writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}
