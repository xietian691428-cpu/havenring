import { clearSealPrepState, finalizeSealChainFromSdmResponse } from "./sealFlowClient";
import type { FinalizeSealWithTicketOptions } from "./sealTypes";
import { SEAL_SUCCESS_PATH } from "./sealTypes";
import {
  USER_FACING,
  shouldQueueSealFailure,
  userFacingSealError,
} from "@/lib/user-facing-errors";
import { enqueueSealFinalize } from "@/src/services/offlineSyncQueue";

export type FinalizeSealResult =
  | { ok: true; kind: "success" }
  | { ok: false; kind: "error"; message: string; queued?: boolean };

/**
 * Finalize after ring tap without crashing the whole app on unhandled throws.
 * Network failures enqueue for background retry with calm local-save copy.
 */
export async function finalizeSealChainFromSdmResponseSafe(
  opts: FinalizeSealWithTicketOptions
): Promise<FinalizeSealResult> {
  try {
    await finalizeSealChainFromSdmResponse(opts);
    return { ok: true, kind: "success" };
  } catch (error) {
    if (shouldQueueSealFailure(error)) {
      await enqueueSealFinalize({
        sealTicket: opts.sealTicket,
        draftIds: opts.draftIds,
      });
      return {
        ok: false,
        kind: "error",
        message: USER_FACING.sealSavedLocal,
        queued: true,
      };
    }
    return {
      ok: false,
      kind: "error",
      message: userFacingSealError(error),
    };
  }
}

export function goToSealSuccess() {
  if (typeof window !== "undefined") {
    window.location.assign(SEAL_SUCCESS_PATH);
  }
}

export function clearSealFlowAndReturnToApp() {
  clearSealPrepState();
  if (typeof window !== "undefined") {
    window.location.assign("/app");
  }
}
