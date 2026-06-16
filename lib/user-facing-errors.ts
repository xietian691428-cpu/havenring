/**
 * Map internal error codes / API messages to ≤1 sentence user copy.
 * No Retire, hash, sync, or other technical terms in user-facing strings.
 */

export const USER_FACING = {
  tapRingAgain: "Hold your ring near your phone once more.",
  syncing: "Syncing…",
  joinFailed: "Could not join — try again.",
  bindFailed: "Could not link your ring — try again.",
  signInRequired: "Sign in to continue.",
  signInFailed: "Sign-in could not start.",
  passwordWrong: "Wrong password — try again.",
  passwordTooShort: "Password must be at least 6 characters.",
  passwordMismatch: "Passwords do not match.",
  inviteExpired: "This link expired — ask for a new one.",
  inviteComplete: "You're already linked.",
  inviteInvalid: "This link is no longer valid — ask for a new one.",
  separateAccount: "Use your own Apple or Google account.",
  ringOtherAccount: "This ring belongs to another account.",
  ringCannotUse: "This ring cannot be used with this account.",
  ringAlreadyLinked: "This ring is already on your account.",
  networkRetry: "Connection issue — try again in a moment.",
  securitySetupFailed: "Could not set up your device password.",
  listeningRing: "Hold your ring near your phone…",
  sealSavedLocal: "Saved on this device — we'll sync when you're back online.",
  sealFinishing: "Finishing…",
  syncingBackground: "Syncing in the background.",
  signInContinue: "Sign in to continue.",
} as const;

const CODE_MAP: Record<string, string> = {
  INVALID_INVITE: USER_FACING.inviteInvalid,
  INVITE_KEY_NOT_FOUND: USER_FACING.inviteInvalid,
  INVITE_REQUIRES_SEPARATE_ACCOUNT: USER_FACING.separateAccount,
  RING_NON_TRANSFERABLE: USER_FACING.ringCannotUse,
  RING_BOUND_TO_OTHER_USER: USER_FACING.ringOtherAccount,
  RING_LIMIT_REACHED: USER_FACING.ringAlreadyLinked,
  HAVEN_PAIR_FULL: USER_FACING.inviteComplete,
  JOIN_NOT_SOLO_HAVEN: USER_FACING.joinFailed,
  JOIN_UID_MISMATCH: USER_FACING.tapRingAgain,
  NO_ACTIVE_RING: USER_FACING.tapRingAgain,
  INVITE_LOOKUP_FAILED: USER_FACING.networkRetry,
  MEMBER_UPSERT_FAILED: USER_FACING.joinFailed,
  RING_MOVE_FAILED: USER_FACING.joinFailed,
  ring_binding_is_non_transferable: USER_FACING.ringCannotUse,
  BIND_CONFLICT: USER_FACING.bindFailed,
  SDM_REPLAY_DETECTED: USER_FACING.tapRingAgain,
  list_failed: USER_FACING.networkRetry,
  unauthenticated: USER_FACING.signInRequired,
};

function scrubTechnicalMessage(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/retire|hash|sync failed|secondary verification|haven_id|nfc_uid|ring_binding|non_transferable|binding_is_non/i.test(text)) {
    return "";
  }
  if (/missing ring id|tap the ring again/i.test(text)) {
    return USER_FACING.tapRingAgain;
  }
  if (/timed out|network|offline|fetch failed|aborted/i.test(text)) {
    return USER_FACING.networkRetry;
  }
  if (/verification failed/i.test(text)) {
    return USER_FACING.passwordWrong;
  }
  if (/ring_binding|non_transferable/i.test(text)) {
    return USER_FACING.ringCannotUse;
  }
  if (/invite.*expired|invalid invite/i.test(text)) {
    return USER_FACING.inviteInvalid;
  }
  if (/already linked|already paired|pair full/i.test(text)) {
    return USER_FACING.inviteComplete;
  }
  if (text.length > 90) {
    return USER_FACING.tapRingAgain;
  }
  return text;
}

export function userFacingMessageFromCode(
  code: string | null | undefined,
  fallback: string = USER_FACING.joinFailed
): string {
  const key = String(code || "").trim();
  if (key && CODE_MAP[key]) return CODE_MAP[key]!;
  return fallback;
}

export function userFacingMessageFromUnknown(
  error: unknown,
  fallback: string = USER_FACING.joinFailed
): string {
  if (typeof error === "string") {
    const scrubbed = scrubTechnicalMessage(error);
    return scrubbed || fallback;
  }
  if (error instanceof Error) {
    const scrubbed = scrubTechnicalMessage(error.message);
    return scrubbed || fallback;
  }
  return fallback;
}

export function userFacingBindError(
  payload: { code?: string; error?: string } | null | undefined,
  status: number,
  options: { inviteFlow?: boolean } = {}
): string {
  const fallback = options.inviteFlow
    ? USER_FACING.joinFailed
    : USER_FACING.bindFailed;
  const code = String(payload?.code || "").trim();
  if (code) {
    return userFacingMessageFromCode(code, fallback);
  }
  const apiMsg = scrubTechnicalMessage(String(payload?.error || ""));
  if (apiMsg) return apiMsg;
  if (status === 409) return USER_FACING.ringAlreadyLinked;
  if (status === 403) return USER_FACING.inviteInvalid;
  if (status >= 500) return USER_FACING.networkRetry;
  return fallback;
}

export function isRetryableNetworkFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  if (/aborted|timeout|timed out|network|failed to fetch|econnreset/i.test(msg)) {
    return true;
  }
  return false;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function shouldQueueSealFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  if (isRetryableNetworkFailure(error)) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error || "");
  return /offline|timed out|failed to fetch|network|could not finish|sealing timed out|saved locally/i.test(
    msg
  );
}

/** Seal finalize / NFC tap failures — one short sentence. */
export function userFacingSealError(error: unknown): string {
  if (shouldQueueSealFailure(error)) {
    return USER_FACING.sealSavedLocal;
  }
  const msg = error instanceof Error ? error.message : String(error || "");
  if (/tap.*ring|hold your ring|seal with ring/i.test(msg)) {
    return USER_FACING.tapRingAgain;
  }
  const scrubbed = userFacingMessageFromUnknown(error, "");
  if (scrubbed) return scrubbed;
  return USER_FACING.tapRingAgain;
}
