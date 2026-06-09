/**
 * Seal prep is tied to an active foreground session. Background / lock screen ends
 * the armed window so a later ring tap opens Haven (daily_access), not seal.
 */

import { clearSealWaitTabActive } from "./sealCrossTab";
import { clearSealPrepState } from "./sealFlowClient";
import { markSealStepUpRequired } from "../../services/deviceTrustService";

export function abandonSealPrepOnSessionBoundary(): void {
  if (typeof window === "undefined") return;
  clearSealPrepState();
  clearSealWaitTabActive();
  markSealStepUpRequired();
}

/** App-wide: lock screen / tab hidden ends in-progress seal prep. */
export function bindSealSessionBoundaryListeners(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onBoundary = () => {
    if (document.visibilityState !== "hidden") return;
    abandonSealPrepOnSessionBoundary();
  };

  window.addEventListener("pagehide", onBoundary);
  document.addEventListener("visibilitychange", onBoundary);

  return () => {
    window.removeEventListener("pagehide", onBoundary);
    document.removeEventListener("visibilitychange", onBoundary);
  };
}
