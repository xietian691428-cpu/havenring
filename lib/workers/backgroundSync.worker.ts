/**
 * Dedicated Worker — seal finalize fetch + staging upload/delete (no IDB / React).
 */

import {
  sealFinalizeNetworkRoundTrip,
  type SealFinalizeNetResult,
} from "@/lib/seal-server-finalize-net";
import {
  deleteStagingNet,
  uploadStagingChunkedNet,
  uploadStagingInlineNet,
  type StagingUploadNetResult,
} from "@/lib/seal-staging-upload-net";
import type { BackgroundSyncRequest, BackgroundSyncResponse } from "@/lib/background-sync-messages";

type WorkerScope = typeof globalThis & {
  postMessage: (message: BackgroundSyncResponse) => void;
  onmessage: ((event: MessageEvent<BackgroundSyncRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;

async function handleRequest(req: BackgroundSyncRequest): Promise<BackgroundSyncResponse> {
  try {
    if (req.kind === "seal_finalize") {
      const result: SealFinalizeNetResult = await sealFinalizeNetworkRoundTrip({
        sealTicket: req.sealTicket,
        draftIds: req.draftIds,
        accessToken: req.accessToken,
        serverPayloads: req.serverPayloads,
      });
      if (!result.ok) {
        return {
          id: req.id,
          ok: false,
          kind: req.kind,
          sealResult: result,
        };
      }
      return { id: req.id, ok: true };
    }

    if (req.kind === "staging_inline") {
      const result: StagingUploadNetResult = await uploadStagingInlineNet(req);
      if (!result.ok) {
        return { id: req.id, ok: false, kind: req.kind, stagingResult: result };
      }
      return { id: req.id, ok: true, stagingId: result.stagingId };
    }

    if (req.kind === "staging_chunked") {
      const result = await uploadStagingChunkedNet(req);
      if (!result.ok) {
        return { id: req.id, ok: false, kind: req.kind, stagingResult: result };
      }
      return { id: req.id, ok: true, stagingId: result.stagingId };
    }

    if (req.kind === "staging_delete") {
      await deleteStagingNet(req.stagingId, req.accessToken);
      return { id: req.id, ok: true };
    }

    throw new Error("unknown-background-sync-request");
  } catch (error) {
    return {
      id: req.id,
      ok: false,
      kind: req.kind,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

scope.onmessage = (event: MessageEvent<BackgroundSyncRequest>) => {
  void handleRequest(event.data).then((result) => {
    scope.postMessage(result);
  });
};
