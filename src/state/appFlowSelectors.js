import { APP_FLOW_MAIN_STATES } from "./appFlowMachine";

export function getRecoveryActionIntent(errorType = "") {
  const kind = String(errorType || "");
  if (kind === "auth_expired") return "reauth";
  if (kind === "bind_failed") return "open_ring_setup";
  if (kind === "hash_mismatch") return "rebuild_and_sync";
  return "retry_sync";
}

/** App lifecycle hook: reconcile cloud Pair state with local ring registry. */
export async function reconcilePairStateOnAppLifecycle() {
  if (typeof window === "undefined") return null;
  const { resolvePairState } = await import("@/lib/pair-state-resolver");
  const { setPairSharingEnabled } = await import("@/src/services/pairSharingService");
  const { flushOfflineSyncQueue } = await import("@/src/services/offlineSyncQueue");
  const { getSupabaseBrowserClient } = await import("@/lib/supabase/client");

  const snapshot = await resolvePairState();
  if (snapshot?.pairActive) {
    setPairSharingEnabled(true);
  }

  try {
    const sb = getSupabaseBrowserClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token || "";
    if (token) {
      await flushOfflineSyncQueue(token);
    }
  } catch {
    /* background flush — non-blocking */
  }

  return snapshot;
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
  if (flowState.mainState === APP_FLOW_MAIN_STATES.SYNC_GATE) {
    return {
      title: "Syncing…",
      body: "",
      actionLabel: "",
      enforceSingle: false,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.PWA_INSTALL_GATE) {
    const isIos = flowState.platform === "ios";
    const isAndroid = flowState.platform === "android";
    const noWebNfcOnIos = isIos && !flowState.webNfcAvailable;
    const title = isAndroid ? "Install Haven on your phone" : "Add to Home Screen recommended";
    const body = isAndroid
      ? "Install Haven from Chrome for a full-screen app icon."
      : noWebNfcOnIos
        ? "Web NFC is unavailable in this browser. Add to Home Screen first for sealing."
        : "On iOS, add Haven to your Home Screen in Safari, then open from the new icon.";
    return {
      title,
      body,
      actionLabel: "Open install guide",
      secondaryActionLabel: "Skip for now",
      secondaryActionIntent: "defer_pwa",
      enforceSingle: true,
    };
  }
  if (flowState.mainState === APP_FLOW_MAIN_STATES.RECOVERY) {
    return {
      title: "Sign in to continue",
      body: "",
      actionLabel: "Sign in",
      enforceSingle: true,
    };
  }
  return null;
}

