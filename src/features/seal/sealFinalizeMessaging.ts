/** JSON body from POST `/api/seal/finalize` (precheck/commit). */
export type SealFinalizeResponseBody = {
  ok?: unknown;
  error?: unknown;
  error_code?: unknown;
};

const MSG_OFFLINE_PREP =
  "You're offline — final seal can't reach Haven right now. Your draft stays safely on this device. Go online and run Seal with Ring again.";

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
      return `${apiMsg || "Seal confirmation expired."} Tap Seal with Ring again — your draft is still local.`;
    case "TICKET_ALREADY_USED":
      return `${apiMsg || "This confirmation was already used."} Tap the ring flow again from Capture. Drafts remain on-device.`;
    case "INVALID_TICKET":
      return `${apiMsg || "Invalid seal confirmation."} Return to Capture and start Seal with Ring again.`;
    case "MISSING_SEAL_DATA":
      return `${apiMsg || "Missing seal data."} Your draft should still be in the Draft Box — try seal again.`;
    case "DRAFT_SET_MISMATCH":
    case "DRAFT_PAYLOAD_MISMATCH":
    case "SEAL_COMMIT_REJECTED":
      return `${apiMsg || "Seal could not confirm this draft bundle."} Edits stayed local — save again, then retry ring seal.`;
    case "MISSING_DRAFT_PAYLOADS":
      return `${apiMsg || "Seal payload incomplete."} Re-save from Capture, then retry.`;
    case "UNAUTHORIZED":
      return "Sign in again, then reopen the ring seal link or tap Seal once more.";
    default:
      return apiMsg || fallback;
  }
}

export function sealFinalizeFetchFailedMessage(): string {
  return "Network interrupted while sealing — your drafts are still saved on this device. Reconnect and try the ring seal again.";
}
