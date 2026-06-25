import type { SealDraftFinalizePayload } from "@/src/features/seal/sealTypes";

/** Trim relay payload to fit localStorage quota (staging-sized cap). */
export function slimSealRelayPayload(
  payload: SealDraftFinalizePayload,
  maxBytes: number
): SealDraftFinalizePayload {
  const base = {
    id: payload.id,
    title: payload.title,
    story: payload.story,
    photo: [] as unknown[],
    attachments: [] as unknown[],
    releaseAt: payload.releaseAt,
  };
  let budget = maxBytes - JSON.stringify(base).length;
  const photo: unknown[] = [];
  for (const row of payload.photo) {
    const bytes = JSON.stringify(row).length;
    if (bytes > budget) break;
    photo.push(row);
    budget -= bytes;
  }
  return { ...base, photo };
}
