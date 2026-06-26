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
  const attachments = slimVideoAttachmentsForRelay(payload.attachments);
  const slimAttachments: unknown[] = [];
  for (const row of attachments) {
    const bytes = JSON.stringify(row).length;
    if (bytes > budget) break;
    slimAttachments.push(row);
    budget -= bytes;
  }
  return { ...base, photo, attachments: slimAttachments };
}

/** Relay / localStorage — video metadata + thumb only, never inline clip bytes. */
export function slimVideoAttachmentsForRelay(attachments: unknown[] = []): unknown[] {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((row) => {
    if (!row || typeof row !== "object") return row;
    const mime = String((row as { mimeType?: string }).mimeType || "").toLowerCase();
    const isVideo =
      mime.startsWith("video/") ||
      (row as { videoBlobRef?: boolean }).videoBlobRef === true ||
      (row as { videoPending?: boolean }).videoPending === true;
    if (!isVideo) return row;
    const typed = row as {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: number;
      durationSec?: number;
      thumbDataUrl?: string;
      coverOnly?: boolean;
    };
    return {
      id: typed.id,
      name: typed.name,
      mimeType: typed.mimeType || "video/mp4",
      size: Number(typed.size || 0),
      durationSec: typed.durationSec,
      thumbDataUrl: typed.thumbDataUrl,
      videoBlobRef: true,
      chunkCount: 0,
      videoPending: !typed.coverOnly,
      coverOnly: typed.coverOnly || undefined,
    };
  });
}
