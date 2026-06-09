import { isSealFlowArmed } from "@/lib/seal-flow";
import { hasSdmInUrlSearch } from "./parseRingTapUrl";
import { STORAGE_KEYS } from "@/lib/storage-keys";

/** Cross-tab: Android often opens a second Chrome tab with SDM query params. */
export const SEAL_NFC_TAP_STORAGE_KEY = STORAGE_KEYS.sealNfcTapRelay;

const DEFAULT_MAX_AGE_MS = 120_000;

export function recordSealNfcTapHref(href: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(href, window.location.origin);
    if (!hasSdmInUrlSearch(url.search)) return;
    if (isSealFlowArmed() && !url.searchParams.get("intent")) {
      url.searchParams.set("intent", "seal");
    }
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

export function consumeFreshSealNfcTapHref(opts: {
  sinceTs?: number;
  maxAgeMs?: number;
} = {}): string | null {
  if (typeof window === "undefined") return null;
  const sinceTs = typeof opts.sinceTs === "number" ? opts.sinceTs : 0;
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  let best: { href: string; ts: number } | null = null;

  for (const store of [window.sessionStorage, window.localStorage] as const) {
    try {
      const raw = store.getItem(SEAL_NFC_TAP_STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { href?: string; ts?: number };
      const href = String(parsed.href || "").trim();
      const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
      if (!href || ts < sinceTs || Date.now() - ts > maxAgeMs) continue;
      const url = new URL(href, window.location.origin);
      if (!hasSdmInUrlSearch(url.search)) continue;
      if (!best || ts > best.ts) best = { href: url.href, ts };
    } catch {
      continue;
    }
  }

  if (best) clearSealNfcTapHref();
  return best?.href ?? null;
}

export function clearSealNfcTapHref(): void {
  if (typeof window === "undefined") return;
  for (const store of [window.sessionStorage, window.localStorage] as const) {
    try {
      store.removeItem(SEAL_NFC_TAP_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
