/** JSON body from POST `/api/seal/finalize` (precheck/commit). */
export type SealFinalizeResponseBody = {
  ok?: unknown;
  error?: unknown;
  error_code?: unknown;
};

import { SEAL_STAGING_OFFLINE } from "./sealUserMessages";

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
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "TICKET_ALREADY_USED":
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "INVALID_TICKET":
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "MISSING_SEAL_DATA":
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "DRAFT_SET_MISMATCH":
    case "DRAFT_PAYLOAD_MISMATCH":
    case "SEAL_COMMIT_REJECTED":
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "MISSING_DRAFT_PAYLOADS":
      return "Tap Seal with Ring again, then hold your ring until it finishes.";
    case "UNAUTHORIZED":
      return "Sign in, then tap Seal with Ring again.";
    default:
      return apiMsg || fallback;
  }
}

export function sealFinalizeFetchFailedMessage(): string {
  return "You're offline — connect, then tap your ring again.";
}
