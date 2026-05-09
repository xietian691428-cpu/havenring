import { createHash } from "crypto";

/** Must match draft id limits in seal ticket issuance (`seal_tickets.draft_ids`). */
export const MAX_SEAL_DRAFT_IDS = 20;

/** SDM POST `context` and resolve `scene` for seal completion. */
export const SEAL_CONFIRMATION_CONTEXT = "seal_confirmation";

/** Raw NFC / SDM body: newest-first authoring order, capped. */
export function parseSealDraftIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => String(row || "").trim())
    .filter(Boolean)
    .slice(0, MAX_SEAL_DRAFT_IDS);
}

/** Compare sets against stored ticket rows and finalize payloads (sorted). */
export function parseSealDraftIdsSorted(input: unknown): string[] {
  return [...parseSealDraftIds(input)].sort();
}

export function sealTicketExpiryMs(): number {
  const raw = process.env.NFC_SEAL_TICKET_TTL_SECONDS;
  const fallbackMs = 5 * 60 * 1000;
  if (!raw) return fallbackMs;
  const sec = Number.parseInt(raw, 10);
  if (!Number.isFinite(sec) || sec < 60) return fallbackMs;
  return Math.min(sec, 15 * 60) * 1000;
}

export function hashSealTicketSecret(plainTicket: string): string {
  return createHash("sha256").update(plainTicket).digest("hex");
}
