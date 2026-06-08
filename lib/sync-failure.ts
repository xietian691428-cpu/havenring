export type SyncFailureKind = "offline" | "auth" | "sync" | "hash";

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Classify a sync failure without blaming "network" when we cannot know. */
export function classifySyncFailure(options: {
  httpStatus?: number;
  error?: unknown;
} = {}): Exclude<SyncFailureKind, "hash"> {
  if (isBrowserOffline()) {
    return "offline";
  }
  if (options.httpStatus === 401) {
    return "auth";
  }
  const message =
    options.error instanceof Error
      ? options.error.message
      : String(options.error || "");
  if (/sign-in|auth|session|token|unauthorized/i.test(message)) {
    return "auth";
  }
  return "sync";
}
