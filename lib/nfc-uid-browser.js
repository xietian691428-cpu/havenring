/**
 * Browser-safe NFC UID normalization (kept in sync with `lib/nfc-uid.ts`).
 * No Node `crypto` — safe for client bundles.
 */
export function normalizeNfcUidInput(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/^0x/i, "").replace(/[\s:-]/g, "");
}
