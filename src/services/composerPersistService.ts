// @ts-nocheck — mirrors legacy useMemories persist path until localMemoryStore is fully typed.
import { releaseAllTimelineThumbUrls } from "@/lib/timeline-thumb-cache";
import { memoryPayloadToTimelinePreview } from "@/lib/timeline-memory-preview";
import { photoPayloadHasLargeBlob } from "@/lib/timeline-large-media";
import { markPostSealComplete } from "@/lib/post-seal-memory-guard";
import { computeMemoryBundleHash } from "../utils/memoryIntegrity";
import {
  createMemory,
  getMemoryById,
  saveMemory,
} from "./localStorageService";
import { stageDraftForActiveRing } from "./ringSyncService";

export type ComposerPersistResult = {
  id: string;
  preview: ReturnType<typeof memoryPayloadToTimelinePreview>;
};

/**
 * Persist composer output to encrypted local timeline (create or replace by id).
 * Shared by ComposerDraftProvider and MemoriesProvider — no React state here.
 */
export async function persistComposerMemoryPayload(
  payload: Record<string, unknown>
): Promise<ComposerPersistResult> {
  releaseAllTimelineThumbUrls();
  const id = String(payload?.id || "").trim();
  if (!id) {
    throw new Error("Missing memory id.");
  }
  const now = Date.now();
  const enrichedPayload = {
    ...payload,
    id,
    title: String(payload?.title || "").trim() || "Untitled memory",
    story: String(payload?.story || ""),
    photo:
      Array.isArray(payload?.photo) && payload.photo.length ? payload.photo : null,
    attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
    timelineAt: Number(payload?.timelineAt || now) || now,
    releaseAt: Number(payload?.releaseAt || 0) || 0,
  };
  const contentSha = await computeMemoryBundleHash({
    title: enrichedPayload.title,
    story: enrichedPayload.story,
    timelineAt: enrichedPayload.timelineAt,
    releaseAt: enrichedPayload.releaseAt,
    photos: Array.isArray(enrichedPayload.photo) ? enrichedPayload.photo : [],
  });
  await stageDraftForActiveRing({
    id,
    title: enrichedPayload.title || "",
    timelineAt: enrichedPayload.timelineAt,
    releaseAt: enrichedPayload.releaseAt,
    content_sha256: contentSha,
  });

  const existing = await getMemoryById(id);
  let savedMeta;
  if (existing) {
    savedMeta = await saveMemory({
      ...existing,
      title: enrichedPayload.title,
      story: enrichedPayload.story,
      photo: enrichedPayload.photo ?? existing.photo,
      attachments: enrichedPayload.attachments,
      releaseAt: enrichedPayload.releaseAt,
      timelineAt: enrichedPayload.timelineAt,
    });
  } else {
    savedMeta = await createMemory(enrichedPayload);
  }

  const preview = memoryPayloadToTimelinePreview(
    {
      ...enrichedPayload,
      createdAt: savedMeta.createdAt ?? existing?.createdAt,
      updatedAt: savedMeta.updatedAt,
    },
    existing
  );
  if (photoPayloadHasLargeBlob(enrichedPayload.photo)) {
    markPostSealComplete({ hasLargeMedia: true });
  }
  return { id, preview };
}
