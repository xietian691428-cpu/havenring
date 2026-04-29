import { createHash } from "node:crypto";

/** Normalize NFC UID / scan payload to a stable string before hashing. */
export function normalizeNfcUidInput(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  // Strip common separators from hex scans.
  return s.replace(/^0x/i, "").replace(/[\s:-]/g, "");
}

/** Server-side fingerprint for storage & lookups (never persist raw UID). */
export function hashNfcUid(normalized: string): string {
  if (!normalized) return "";
  return createHash("sha256").update(`nfc:${normalized}`, "utf8").digest("hex");
}
