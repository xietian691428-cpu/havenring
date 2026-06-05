import { hasSdmSearch, readNfcIntent } from "@/lib/nfc-intent";
import { isSealFlowArmed } from "@/lib/seal-flow";
import { isSealWaitTabActive } from "./sealCrossTab";
import { readPendingSealDraftIds } from "./sealFlowClient";

export const SEAL_WAIT_QUERY = "seal_wait";

function normalizeSearch(search: string): string {
  if (!search) return "";
  return search.startsWith("?") ? search : `?${search}`;
}

export function isSealWaitSearch(search: string = ""): boolean {
  const sp = new URLSearchParams(normalizeSearch(search).slice(1));
  return sp.get(SEAL_WAIT_QUERY) === "1";
}

/** User opened `/start?seal_wait=1` from composer before tapping the ring. */
export function hasLocalSealPrep(): boolean {
  return isSealFlowArmed() || readPendingSealDraftIds().length > 0;
}

/**
 * NFC opened a bare /start?sdm tab without draft arm in this context while the wait page
 * is active — relay only; let the wait tab navigate and resolve with seal prep.
 */
export function shouldDeferSdmResolveToOwnerTab(search: string = ""): boolean {
  const q = normalizeSearch(search);
  if (!hasSdmSearch(q)) return false;
  if (hasLocalSealPrep()) return false;
  if (isSealWaitSearch(q) || readNfcIntent(q) === "seal") return false;
  return isSealWaitTabActive();
}

export function sealRelayNavigateHref(relayHref: string): string {
  if (typeof window === "undefined") return relayHref;
  const url = new URL(relayHref, window.location.origin);
  if (hasLocalSealPrep() || isSealWaitTabActive()) {
    url.searchParams.set("intent", "seal");
  }
  return url.href;
}

export function isPrimarySealWaitPage(search: string = ""): boolean {
  if (typeof window === "undefined") return false;
  const q = normalizeSearch(search);
  if (!isSealWaitSearch(q)) return false;
  const intent = readNfcIntent(q);
  return intent === "seal" || isSealFlowArmed();
}

/**
 * NFC opened /start with SDM (typical Android new tab). Seal completes on THIS page.
 */
export function isRingTapSealLandingPage(search: string = ""): boolean {
  if (typeof window === "undefined") return false;
  const q = normalizeSearch(search);
  if (!hasSdmSearch(q)) return false;
  const intent = readNfcIntent(q);
  return hasLocalSealPrep() || intent === "seal";
}

/** @deprecated Use isRingTapSealLandingPage */
export const isAuxiliarySealTapTab = isRingTapSealLandingPage;

/** After arming seal prep on /app, continue on /start so Android NFC opens the right page. */
export function navigateToSealWaitPage(): void {
  if (typeof window === "undefined") return;
  const url = new URL("/start", window.location.origin);
  url.searchParams.set(SEAL_WAIT_QUERY, "1");
  url.searchParams.set("intent", "seal");
  window.location.assign(url.href);
}
