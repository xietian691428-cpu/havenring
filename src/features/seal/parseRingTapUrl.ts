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

    const cmac = url.searchParams.get("cmac") || "";
    const picc = url.searchParams.get("picc") || url.searchParams.get("picc_data") || "";
    const uid = url.searchParams.get("uid") || "";
    const ctr = url.searchParams.get("ctr") || "";
    const hasSdm = Boolean(cmac) && (Boolean(picc) || (Boolean(uid) && Boolean(ctr)));
    if (!hasSdm) return null;

    const start = new URL("/start", base);
    for (const [key, value] of url.searchParams.entries()) {
      start.searchParams.set(key, value);
    }
    return start.href;
  } catch {
    return null;
  }
}
