/**
 * Coordinator: dispatch network-heavy seal finalize / staging to Dedicated Worker,
 * fall back to main-thread net helpers when Worker is unavailable.
 */

import type { BackgroundSyncRequest, BackgroundSyncResponse } from "@/lib/background-sync-messages";
import { sealFinalizeNetworkRoundTrip } from "@/lib/seal-server-finalize-net";
import {
  deleteStagingNet,
  uploadStagingChunkedNet,
  uploadStagingInlineNet,
} from "@/lib/seal-staging-upload-net";
import {
  userMessageFromFinalizeResponse,
  type SealFinalizeResponseBody,
} from "@/src/features/seal/sealFinalizeMessaging";
import {
  SEAL_STAGING_TOO_LARGE,
  throwSealStagingTooLarge,
} from "@/src/features/seal/sealUserMessages";

let worker: Worker | null = null;
let workerFailed = false;
const pending = new Map<
  string,
  {
    resolve: (value: BackgroundSyncResponse) => void;
    reject: (error: Error) => void;
    timer: number;
  }
>();

function nextRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `bg-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./workers/backgroundSync.worker.ts", import.meta.url));
    worker.addEventListener("message", (event: MessageEvent<BackgroundSyncResponse>) => {
      const row = pending.get(event.data.id);
      if (!row) return;
      pending.delete(event.data.id);
      window.clearTimeout(row.timer);
      row.resolve(event.data);
    });
    worker.addEventListener("error", () => {
      workerFailed = true;
      worker?.terminate();
      worker = null;
      for (const [id, row] of pending.entries()) {
        pending.delete(id);
        window.clearTimeout(row.timer);
        row.reject(new Error("background-sync-worker-error"));
      }
    });
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

const WORKER_TIMEOUT_MS = 120_000;

function dispatchRequest(req: BackgroundSyncRequest): Promise<BackgroundSyncResponse> {
  const instance = getWorker();
  if (!instance) {
    return runOnMainThread(req);
  }
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(req.id);
      reject(new Error("background-sync-timeout"));
    }, WORKER_TIMEOUT_MS);
    pending.set(req.id, { resolve, reject, timer });
    instance.postMessage(req);
  });
}

async function runOnMainThread(req: BackgroundSyncRequest): Promise<BackgroundSyncResponse> {
  if (req.kind === "seal_finalize") {
    const sealResult = await sealFinalizeNetworkRoundTrip({
      sealTicket: req.sealTicket,
      draftIds: req.draftIds,
      accessToken: req.accessToken,
      serverPayloads: req.serverPayloads,
    });
    if (!sealResult.ok) {
      return { id: req.id, ok: false, kind: req.kind, sealResult };
    }
    return { id: req.id, ok: true };
  }
  if (req.kind === "staging_inline") {
    const stagingResult = await uploadStagingInlineNet(req);
    if (!stagingResult.ok) {
      return { id: req.id, ok: false, kind: req.kind, stagingResult };
    }
    return { id: req.id, ok: true, stagingId: stagingResult.stagingId };
  }
  if (req.kind === "staging_chunked") {
    const stagingResult = await uploadStagingChunkedNet(req);
    if (!stagingResult.ok) {
      return { id: req.id, ok: false, kind: req.kind, stagingResult };
    }
    return { id: req.id, ok: true, stagingId: stagingResult.stagingId };
  }
  if (req.kind === "staging_delete") {
    await deleteStagingNet(req.stagingId, req.accessToken);
    return { id: req.id, ok: true };
  }
  throw new Error("unknown-background-sync-request");
}

function mapSealFinalizeError(res: BackgroundSyncResponse): never {
  if (res.ok || !("sealResult" in res) || !res.sealResult || res.sealResult.ok) {
    throw new Error("Seal could not be completed.");
  }
  const body = res.sealResult.body as SealFinalizeResponseBody;
  const fallback =
    res.sealResult.step === "precheck"
      ? "Seal verification could not be completed."
      : "Seal could not be completed.";
  throw new Error(userMessageFromFinalizeResponse(body, fallback));
}

function mapStagingUploadError(
  res: BackgroundSyncResponse,
  isPlus: boolean
): never {
  if (res.ok || !("stagingResult" in res) || !res.stagingResult || res.stagingResult.ok) {
    throw new Error("Could not prepare your memory for sealing.");
  }
  const staging = res.stagingResult;
  if (staging.body.error_code === "STAGING_TOO_LARGE" || staging.status === 413) {
    throwSealStagingTooLarge(isPlus, true);
  }
  const msg =
    typeof staging.body.error === "string" && staging.body.error.trim()
      ? staging.body.error.trim()
      : staging.body.error_code === "STAGING_DISABLED" || staging.status === 503
        ? "Sealing is briefly unavailable — try again in a moment."
        : "Could not prepare your memory for sealing.";
  if (msg === SEAL_STAGING_TOO_LARGE) {
    throwSealStagingTooLarge(isPlus, true);
  }
  throw new Error(msg);
}

export async function runSealFinalizeNetwork(opts: {
  sealTicket: string;
  draftIds: string[];
  accessToken: string;
  serverPayloads: unknown[];
}): Promise<void> {
  const id = nextRequestId();
  const res = await dispatchRequest({
    id,
    kind: "seal_finalize",
    sealTicket: opts.sealTicket,
    draftIds: opts.draftIds,
    accessToken: opts.accessToken,
    serverPayloads: opts.serverPayloads,
  });
  if (!res.ok) {
    mapSealFinalizeError(res);
  }
}

export async function runStagingInlineUpload(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  isPlus?: boolean;
}): Promise<string> {
  const id = nextRequestId();
  const res = await dispatchRequest({
    id,
    kind: "staging_inline",
    draftIds: opts.draftIds,
    ciphertext: opts.ciphertext,
    iv: opts.iv,
    accessToken: opts.accessToken,
  });
  if (!res.ok || !res.stagingId) {
    mapStagingUploadError(res, Boolean(opts.isPlus));
  }
  return res.stagingId!;
}

export async function runStagingChunkedUpload(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  chunkChars: number;
  uploadId: string;
  isPlus?: boolean;
}): Promise<string> {
  const id = nextRequestId();
  const res = await dispatchRequest({
    id,
    kind: "staging_chunked",
    draftIds: opts.draftIds,
    ciphertext: opts.ciphertext,
    iv: opts.iv,
    accessToken: opts.accessToken,
    chunkChars: opts.chunkChars,
    uploadId: opts.uploadId,
  });
  if (!res.ok || !res.stagingId) {
    mapStagingUploadError(res, Boolean(opts.isPlus));
  }
  return res.stagingId!;
}

export async function runStagingDeleteInBackground(
  stagingId: string,
  accessToken: string
): Promise<void> {
  const id = nextRequestId();
  await dispatchRequest({
    id,
    kind: "staging_delete",
    stagingId,
    accessToken,
  });
}

export function terminateBackgroundSyncWorker(): void {
  worker?.terminate();
  worker = null;
  workerFailed = false;
}
