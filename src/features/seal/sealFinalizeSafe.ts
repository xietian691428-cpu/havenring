import { clearSealPrepState, finalizeSealChainFromSdmResponse } from "./sealFlowClient";
import type { FinalizeSealWithTicketOptions } from "./sealTypes";
import { SEAL_SUCCESS_PATH } from "./sealTypes";
import {
  userFacingSealError,
} from "@/lib/user-facing-errors";

export type FinalizeSealResult =
  | { ok: true; kind: "success" }
  | { ok: false; kind: "error"; message: string };

/**
 * Finalize after ring tap — local-first (Phase 1).
 * Server finalize runs in background; only local persist failures surface to the user.
 */
export async function finalizeSealChainFromSdmResponseSafe(
  opts: FinalizeSealWithTicketOptions
): Promise<FinalizeSealResult> {
  try {
    await finalizeSealChainFromSdmResponse(opts);
    return { ok: true, kind: "success" };
  } catch (error) {
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
