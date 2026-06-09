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

/** Explicit seal session armed in-app (not orphan draft ids). */
export function hasLocalSealPrep(): boolean {
  return isSealFlowArmed();
}

/**
 * NFC opened a bare /start?sdm tab while a seal-wait tab is active.
 * Always resolve on the NFC (foreground) tab — iOS Safari throttles background wait
 * tabs so defer+relay deadlocks and users see endless "Reading your ring…" tabs.
 */
export function shouldDeferSdmResolveToOwnerTab(search: string = ""): boolean {
  const q = normalizeSearch(search);
  if (!hasSdmSearch(q)) return false;
  if (hasLocalSealPrep()) return false;
  if (isSealWaitSearch(q) || readNfcIntent(q) === "seal") return false;
  if (isSealWaitTabActive()) return false;
  return false;
}

export function sealRelayNavigateHref(relayHref: string): string {
  if (typeof window === "undefined") return relayHref;
  const url = new URL(relayHref, window.location.origin);
  if (hasLocalSealPrep()) {
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
