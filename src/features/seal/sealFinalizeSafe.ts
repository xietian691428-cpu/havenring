import { clearSealPrepState, finalizeSealChainFromSdmResponse } from "./sealFlowClient";
import type { FinalizeSealWithTicketOptions } from "./sealTypes";
import { SEAL_SUCCESS_PATH } from "./sealTypes";

export type FinalizeSealResult =
  | { ok: true; kind: "success" }
  | { ok: false; kind: "error"; message: string };

/**
 * Finalize after ring tap without crashing the whole app on unhandled throws.
 */
export async function finalizeSealChainFromSdmResponseSafe(
  opts: FinalizeSealWithTicketOptions
): Promise<FinalizeSealResult> {
  try {
    await finalizeSealChainFromSdmResponse(opts);
    return { ok: true, kind: "success" };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Seal could not finish. Your draft is still saved locally.";
    return { ok: false, kind: "error", message };
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
