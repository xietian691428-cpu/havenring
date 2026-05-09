import { APP_FLOW_MAIN_STATES } from "./appFlowMachine";

export function getRecoveryActionIntent(errorType = "") {
  const kind = String(errorType || "");
  if (kind === "auth_expired") return "reauth";
  if (kind === "bind_failed") return "open_ring_setup";
  if (kind === "hash_mismatch") return "rebuild_and_sync";
  return "retry_sync";
}

export function getFlowPrimaryUi(flowState) {
  if (flowState.mainState === APP_FLOW_MAIN_STATES.AUTH_GATE) {
    return {
      title: "Sign-in required",
      body: "Complete account sign-in to continue into your memory sanctuary. Touch detection alone is not final proof on new or high-risk devices.",
      actionLabel: "Continue sign-in",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.RING_SETUP_GATE) {
    const isIos = flowState.platform === "ios";
    const noWebNfcOnIos = isIos && !flowState.webNfcAvailable;
    return {
      title: "Ring binding required",
      body: noWebNfcOnIos
        ? "This device cannot use Web NFC in browser. Add to Home Screen first, then use Ring Link URL or manual bind fallback."
        : isIos
          ? "Session is valid but no ring is bound yet. On iOS, use Ring Link URL or manual bind fallback for first ring."
          : "Session is valid but no ring is bound yet. Ring setup is strongly recommended for fast access, but your account remains the core owner.",
      actionLabel: "Bind a ring",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.SYNC_GATE) {
    return {
      title: "Syncing data",
      body: "Please wait while account and ring data sync completes.",
      actionLabel: "Retry sync",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.PWA_INSTALL_GATE) {
    const noWebNfcOnIos = flowState.platform === "ios" && !flowState.webNfcAvailable;
    return {
      title: "Add to Home Screen recommended",
      body: noWebNfcOnIos
        ? "Web NFC is unavailable in this browser. Add to Home Screen first for a more reliable daily entry."
        : "On iOS, open Haven from your Home Screen icon for a smoother daily experience. Ring ritual remains optional.",
      actionLabel: "Open install guide",
      secondaryActionLabel: "Skip for now",
      secondaryActionIntent: "defer_pwa",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.RECOVERY) {
    const errorType = String(flowState.recoveryErrorType || "");
    const isAuthExpired = errorType === "auth_expired";
    const isHashMismatch = errorType === "hash_mismatch";
    const isBindFailed = errorType === "bind_failed";
    const body = isAuthExpired
      ? "Session expired. Re-authenticate before continuing."
      : isHashMismatch
        ? "Integrity mismatch detected. Rebuild and resync first."
        : isBindFailed
          ? "Ring binding failed. Retry binding with secondary verification."
          : "Network or sync issue detected. Run recovery and retry.";
    const actionIntent = getRecoveryActionIntent(errorType);
    const actionLabel = actionIntent === "reauth"
      ? "Re-authenticate"
      : actionIntent === "open_ring_setup"
        ? "Retry ring binding"
        : actionIntent === "rebuild_and_sync"
          ? "Rebuild local cache"
          : "Recover now";
    return {
      title: "Recovery required",
      body,
      actionLabel,
      enforceSingle: true,
    };
  }
  return null;
}

