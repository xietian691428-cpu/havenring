/**
 * Local relay for Seal finalize — survives staging-only prep and offline tap tab.
 * Source of truth for persistSealedDraftsLocallyFirst when IDB draft is unavailable.
 */
import { writeSealDraftRelay } from "./sealDraftRelay";
import { writeSealPrepBundle } from "./sealPrepBundle";
import type { SealDraftFinalizePayload } from "./sealTypes";

/** Write relay + prep bundle before any network staging (Phase 1.1). */
export function persistSealLocalRelay(
  draftIds: string[],
  payload: SealDraftFinalizePayload
): void {
  const ids = draftIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length || !payload?.id) return;
  writeSealDraftRelay(payload);
  writeSealPrepBundle({ draftIds: ids, relay: payload });
}
