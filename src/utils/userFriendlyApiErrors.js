export function getApiErrorCode(payload = {}, fallbackStatus = 0) {
  const code =
    typeof payload?.error_code === "string" ? payload.error_code.trim() : "";
  if (code) return code;
  if (fallbackStatus === 429) return "RATE_LIMITED";
  if (fallbackStatus === 401) return "UNAUTHORIZED";
  if (fallbackStatus === 404) return "NOT_FOUND";
  return "UNKNOWN_ERROR";
}

export function getUserFriendlyMessage(errorCode, t) {
  switch (String(errorCode || "")) {
    case "INVALID_TICKET":
      return t.errInvalidTicket;
    case "TICKET_EXPIRED":
      return t.errTicketExpired;
    case "TICKET_ALREADY_USED":
      return t.errTicketUsed;
    case "INVALID_NFC_UID":
      return t.errInvalidRingTouch;
    case "RING_NOT_LINKED":
      return t.errRingNotLinked;
    case "RATE_LIMITED":
      return t.errRateLimited;
    case "UNAUTHORIZED":
      return t.errNeedSignIn;
    default:
      return t.errGenericWarmFallback;
  }
}
