import { USER_FACING } from "@/lib/user-facing-errors";
import { SEAL_STAGING_OFFLINE } from "./sealUserMessages";

/** JSON body from POST `/api/seal/finalize` (precheck/commit). */
export type SealFinalizeResponseBody = {
  ok?: unknown;
  error?: unknown;
  error_code?: unknown;
};

const MSG_OFFLINE_PREP = SEAL_STAGING_OFFLINE;

export function ensureBrowserOnlineForSealFinalize(): void {
  if (typeof navigator === "undefined") return;
  if (navigator.onLine === false) {
    throw new Error(MSG_OFFLINE_PREP);
  }
}

export function userMessageFromFinalizeResponse(
  body: SealFinalizeResponseBody | null | undefined,
  fallback: string
): string {
  const codeRaw = body?.error_code;
  const code = typeof codeRaw === "string" ? codeRaw.trim() : "";
  const apiMsg = typeof body?.error === "string" ? body.error.trim() : "";

  switch (code) {
    case "TICKET_EXPIRED":
    case "TICKET_ALREADY_USED":
    case "INVALID_TICKET":
    case "MISSING_SEAL_DATA":
    case "DRAFT_SET_MISMATCH":
    case "DRAFT_PAYLOAD_MISMATCH":
    case "SEAL_COMMIT_REJECTED":
    case "MISSING_DRAFT_PAYLOADS":
      return USER_FACING.tapRingAgain;
    case "UNAUTHORIZED":
      return USER_FACING.signInContinue;
    default:
      return apiMsg ? userFacingSealApiMessage(apiMsg) : fallback;
  }
}

function userFacingSealApiMessage(raw: string): string {
  const text = String(raw || "").trim();
  if (/offline|network|fetch failed|timed out/i.test(text)) {
    return USER_FACING.sealSavedLocal;
  }
  if (/ticket|draft|tap|ring/i.test(text)) {
    return USER_FACING.tapRingAgain;
  }
  return text.length > 90 ? USER_FACING.tapRingAgain : text;
}

export function sealFinalizeFetchFailedMessage(): string {
  return USER_FACING.sealSavedLocal;
}
