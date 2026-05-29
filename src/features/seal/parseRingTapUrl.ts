/** True when query string has SDM tap verification params (cmac + picc or uid+ctr). */
export function hasSdmInUrlSearch(search: string): boolean {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const cmac = sp.get("cmac") || "";
  const picc = sp.get("picc") || sp.get("picc_data") || "";
  const uid = sp.get("uid") || "";
  const ctr = sp.get("ctr") || "";
  return Boolean(cmac) && (Boolean(picc) || (Boolean(uid) && Boolean(ctr)));
}

/** Ring NDEF template points at /start but Web NFC cannot see mirrored SDM fields. */
export function isStaticStartRingUrl(raw: string, origin: string): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) return false;
  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, base);
    if (url.pathname.includes("/hub")) return false;
    if (!url.pathname.includes("/start")) return false;
    return !hasSdmInUrlSearch(url.search);
  } catch {
    return false;
  }
}

/**
 * Normalize an NFC URL record (or QR) into a /start SDM href on the current origin.
 */
export function normalizeRingTapToStartHref(
  raw: string,
  origin: string
): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const base = String(origin || "").replace(/\/$/, "");
  if (!base) return null;

  try {
    const url = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed)
      : new URL(trimmed.startsWith("/") ? trimmed : `/${trimmed}`, base);

    if (url.pathname.includes("/hub")) return null;
    if (!hasSdmInUrlSearch(url.search)) return null;

    const start = new URL("/start", base);
    for (const [key, value] of url.searchParams.entries()) {
      start.searchParams.set(key, value);
    }
    return start.href;
  } catch {
    return null;
  }
}
