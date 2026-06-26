/**
 * Post-seal quiet: chunk pending videos from File handles into videoChunks IDB.
 */

import {
  isVideoAttachmentRef,
  isVideoPendingRef,
  type VideoAttachmentRef,
} from "@/lib/memory-video-types";
import { putVideoBlobChunked } from "@/lib/video-chunk-store";
import {
  clearVideoFileHandle,
  getVideoFileHandle,
} from "@/lib/video-file-handle-store";
import { getMemoryById, saveMemory } from "@/src/services/localStorageService";

function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function flushDeferredVideoForMemory(memoryId: string): Promise<number> {
  const scopedId = String(memoryId || "").trim();
  if (!scopedId) return 0;

  const memory = await getMemoryById(scopedId);
  if (!memory) return 0;

  const rows = Array.isArray(memory.attachments) ? memory.attachments : [];
  if (!rows.length) return 0;

  let flushed = 0;
  const next: unknown[] = [];

  for (const row of rows) {
    if (!isVideoPendingRef(row) || row.coverOnly) {
      next.push(row);
      continue;
    }

    const attachmentId = String(row.id || "").trim();
    const file = getVideoFileHandle(attachmentId);
    if (!file) {
      next.push(row);
      continue;
    }

    await yieldToMain();
    const chunkCount = await putVideoBlobChunked(scopedId, attachmentId, file);
    clearVideoFileHandle(attachmentId);

    if (chunkCount > 0) {
      const updated: VideoAttachmentRef = {
        ...row,
        chunkCount,
        videoPending: false,
      };
      next.push(updated);
      flushed += 1;
    } else {
      next.push(row);
    }

    await yieldToMain();
  }

  if (flushed > 0) {
    await saveMemory(
      { ...memory, attachments: next },
      { allowCoreEdit: true }
    );
  }

  return flushed;
}

const DEFERRED_VIDEO_START_MS = 2_000;
const DEFERRED_VIDEO_GAP_MS = 800;

/** Run after seal success — never blocks local-first success path. */
export function scheduleDeferredVideoPersist(memoryIds: string[]): void {
  if (typeof window === "undefined") return;
  const ids = memoryIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return;

  window.setTimeout(() => {
    void (async () => {
      for (const memoryId of ids) {
        try {
          await flushDeferredVideoForMemory(memoryId);
        } catch (error) {
          console.warn("[haven-ring] deferred video persist skipped:", memoryId, error);
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, DEFERRED_VIDEO_GAP_MS);
        });
      }
    })();
  }, DEFERRED_VIDEO_START_MS);
}
