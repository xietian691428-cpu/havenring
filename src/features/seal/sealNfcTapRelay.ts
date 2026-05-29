import { hasSdmInUrlSearch } from "./parseRingTapUrl";

/** Cross-tab: Android often opens a second Chrome tab with SDM query params. */
export const SEAL_NFC_TAP_STORAGE_KEY = "haven.seal.last_nfc_tap.v1";

const DEFAULT_MAX_AGE_MS = 120_000;

export function recordSealNfcTapHref(href: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(href, window.location.origin);
    if (!hasSdmInUrlSearch(url.search)) return;
    const payload = JSON.stringify({ href: url.href, ts: Date.now() });
    window.sessionStorage.setItem(SEAL_NFC_TAP_STORAGE_KEY, payload);
    window.localStorage.setItem(SEAL_NFC_TAP_STORAGE_KEY, payload);
  } catch {
    /* ignore */
  }
}

export function readFreshSealNfcTapHref(maxAgeMs = DEFAULT_MAX_AGE_MS): string | null {
  if (typeof window === "undefined") return null;
  for (const store of [window.sessionStorage, window.localStorage] as const) {
    try {
      const raw = store.getItem(SEAL_NFC_TAP_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { href?: string; ts?: number };
      const href = String(parsed.href || "").trim();
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      if (!href || Date.now() - ts > maxAgeMs) continue;
      const url = new URL(href, window.location.origin);
      if (!hasSdmInUrlSearch(url.search)) continue;
      return url.href;
    } catch {
      continue;
    }
  }
  return null;
}
