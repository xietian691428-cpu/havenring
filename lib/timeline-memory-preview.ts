import { getTimelineStoryPreviewMaxChars } from "@/lib/timeline-ios-guard";
import { mergeSupplements } from "@/lib/memory-supplements";
import { photoPayloadHasLargeBlob } from "@/lib/timeline-large-media";
import type { TimelineMemorySummary } from "@/lib/timeline-memory-types";
import type { MemorySupplement } from "@/src/features/memories/localMemoryStore";

function photoCount(photo: unknown): number {
  if (!photo) return 0;
  if (Array.isArray(photo)) return photo.length;
  return 1;
}

type PreviewPayload = {
  id?: string;
  title?: string;
  story?: string;
  photo?: unknown;
  timelineAt?: number;
  releaseAt?: number;
  createdAt?: number;
  updatedAt?: number;
  tags?: unknown[];
  is_sealed?: boolean;
  coreLocked?: boolean;
  pairShared?: boolean;
  ring_id?: string | null;
  haven_id?: string | null;
  createdByUserId?: string | null;
  fromPartner?: boolean;
  supplements?: MemorySupplement[];
};

/**
 * Build a timeline list row from composer/save payload — no IDB read, no photo decrypt.
 */
export function memoryPayloadToTimelinePreview(
  payload: PreviewPayload,
  existing: Partial<TimelineMemorySummary> | null = null
): TimelineMemorySummary {
  const now = Date.now();
  const story = String(payload.story ?? "");
  const previewMax = getTimelineStoryPreviewMaxChars();
  const storyPreview =
    story.length > previewMax ? `${story.slice(0, previewMax).trim()}…` : story;
  const hasPhotos = photoCount(payload.photo) > 0;

  return {
    id: String(payload.id || existing?.id || ""),
    title: String(payload.title || "").trim() || "Untitled memory",
    story: "",
    storyPreview,
    photo: null,
    voice: null,
    attachments: [],
    createdAt: Number(payload.createdAt ?? existing?.createdAt ?? now),
    updatedAt: Number(payload.updatedAt ?? now),
    timelineAt: Number(payload.timelineAt ?? existing?.timelineAt ?? now),
    releaseAt: Number(payload.releaseAt || 0) || 0,
    tags: Array.isArray(payload.tags) ? payload.tags : existing?.tags ?? [],
    is_sealed: Boolean(payload.is_sealed ?? existing?.is_sealed),
    coreLocked: Boolean(payload.coreLocked ?? existing?.coreLocked),
    pairShared: Boolean(payload.pairShared ?? existing?.pairShared),
    ring_id: payload.ring_id ?? existing?.ring_id ?? null,
    haven_id: payload.haven_id ?? existing?.haven_id ?? null,
    createdByUserId: payload.createdByUserId ?? existing?.createdByUserId ?? null,
    fromPartner: Boolean(payload.fromPartner ?? existing?.fromPartner),
    supplements: mergeSupplements(existing?.supplements, payload.supplements),
    hasPhotos,
    hasLargePhotos: photoPayloadHasLargeBlob(payload.photo),
  };
}
