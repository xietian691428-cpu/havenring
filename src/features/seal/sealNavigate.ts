import { hasSdmSearch, readNfcIntent } from "@/lib/nfc-intent";
import { isSealFlowArmed } from "@/lib/seal-flow";

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
export function isPrimarySealWaitPage(search: string = ""): boolean {
  if (typeof window === "undefined") return false;
  const q = normalizeSearch(search);
  if (!isSealWaitSearch(q)) return false;
  const intent = readNfcIntent(q);
  return intent === "seal" || isSealFlowArmed();
}

/**
 * Android often opens a second tab with SDM params only (no seal_wait).
 * That tab must relay the tap to the primary wait page — not resolve SDM itself.
 */
export function isAuxiliarySealTapTab(search: string = ""): boolean {
  if (typeof window === "undefined") return false;
  const q = normalizeSearch(search);
  if (!hasSdmSearch(q) || isSealWaitSearch(q)) return false;
  const intent = readNfcIntent(q);
  return isSealFlowArmed() || intent === "seal";
}

/** After arming seal prep on /app, continue on /start so Android NFC opens the right page. */
export function navigateToSealWaitPage(): void {
  if (typeof window === "undefined") return;
  const url = new URL("/start", window.location.origin);
  url.searchParams.set(SEAL_WAIT_QUERY, "1");
  url.searchParams.set("intent", "seal");
  window.location.assign(url.href);
}
