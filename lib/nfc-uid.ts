import { createHash } from "node:crypto";

/** Normalize NFC UID / scan payload to a stable string before hashing. */
export function normalizeNfcUidInput(raw: string): string {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  // Strip common separators from hex scans.
  return s.replace(/^0x/i, "").replace(/[\s:-]/g, "");
}

/**
 * Compatibility aliases for the same physical UID across readers:
 * - trimmed leading zero variants
 * - odd-length hex padded with one leading zero
 *
 * We keep persisted hash format unchanged while broadening lookup matches.
 */
export function normalizeNfcUidAliases(raw: string): string[] {
  const normalized = normalizeNfcUidInput(raw);
  if (!normalized) return [];
  const aliases = new Set<string>([normalized]);
  if (/^[0-9a-f]+$/.test(normalized)) {
    const trimmed = normalized.replace(/^0+(?=[0-9a-f])/, "");
    if (trimmed) aliases.add(trimmed);
    if (normalized.length % 2 === 1) aliases.add(`0${normalized}`);
    if (trimmed && trimmed.length % 2 === 1) aliases.add(`0${trimmed}`);
  }
  return [...aliases];
}

/** Server-side fingerprint for storage & lookups (never persist raw UID). */
export function hashNfcUid(normalized: string): string {
  if (!normalized) return "";
  return createHash("sha256").update(`nfc:${normalized}`, "utf8").digest("hex");
}

export function hashNfcUidAliases(raw: string): string[] {
  return normalizeNfcUidAliases(raw).map((item) => hashNfcUid(item));
}
