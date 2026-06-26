import {
  MAX_VIDEO_ATTACHMENT_BYTES,
  MAX_VIDEO_DURATION_SEC,
} from "@/lib/seal-local-limits";
import {
  isVideoAttachmentRef,
  isVideoComposerLightRow,
  isVideoMimeType,
  isVideoPendingRef,
  type VideoAttachmentRef,
  type VideoComposerLightRow,
} from "@/lib/memory-video-types";
import {
  clearVideoFileHandle,
  registerVideoFileHandle,
} from "@/lib/video-file-handle-store";
import { SEAL_VIDEO_TOO_LARGE } from "@/src/features/seal/sealUserMessages";

export type ComposerAttachmentRow = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  thumbDataUrl?: string;
  videoPending?: boolean;
  coverOnly?: boolean;
  previewUrl?: string;
  file?: File;
  blob?: Blob;
  dataUrl?: string;
  videoBlobRef?: true;
  chunkCount?: number;
};

export function revokeComposerAttachmentPreview(
  row: ComposerAttachmentRow | null | undefined
): void {
  if (!row?.previewUrl || typeof URL === "undefined") return;
  try {
    URL.revokeObjectURL(row.previewUrl);
    row.previewUrl = undefined;
  } catch {
    /* ignore */
  }
}

export function revokeComposerAttachmentPreviews(rows: ComposerAttachmentRow[] = []): void {
  for (const row of rows) revokeComposerAttachmentPreview(row);
}

export type VideoProbeResult = {
  durationSec: number;
  width: number;
  height: number;
};

function estimateThumbBytes(row: { thumbDataUrl?: string }): number {
  const thumb = typeof row.thumbDataUrl === "string" ? row.thumbDataUrl : "";
  if (!thumb) return 32 * 1024;
  return Math.min(Math.ceil((thumb.length * 3) / 4), 128 * 1024);
}

/** Metadata only — no full decode / transcode / arrayBuffer. */
export async function probeVideoBlob(blob: Blob): Promise<VideoProbeResult> {
  if (typeof document === "undefined") {
    return { durationSec: 0, width: 0, height: 0 };
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };
    video.onloadedmetadata = () => {
      const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      resolve({ durationSec, width, height });
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video-probe-failed"));
    };
    video.src = url;
  });
}

/** First-frame tiny thumb — revokes object URL immediately after capture. */
export async function extractVideoFirstFrameThumb(
  blob: Blob,
  maxDim = 240
): Promise<string> {
  if (typeof document === "undefined") return "";
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    const cleanup = () => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    };
    video.onseeked = () => {
      try {
        const ratio = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
        const width = Math.max(1, Math.round(video.videoWidth * ratio));
        const height = Math.max(1, Math.round(video.videoHeight * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          resolve("");
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const thumb = canvas.toDataURL("image/jpeg", 0.6);
        cleanup();
        resolve(thumb);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("video-thumb-failed"));
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, Math.max(0, (video.duration || 0.1) - 0.01));
    };
    video.src = url;
    video.load();
  });
}

export function assertVideoFitsSealLimits(sizeBytes: number, durationSec = 0): void {
  if (sizeBytes > MAX_VIDEO_ATTACHMENT_BYTES) {
    throw new Error(SEAL_VIDEO_TOO_LARGE);
  }
  if (durationSec > MAX_VIDEO_DURATION_SEC) {
    throw new Error(SEAL_VIDEO_TOO_LARGE);
  }
}

/**
 * Composer pick — metadata + thumb only; File stays in handle store (not React state / relay).
 */
export async function ingestVideoFileLight(file: File): Promise<VideoComposerLightRow> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  assertVideoFitsSealLimits(file.size);

  let probe: VideoProbeResult = { durationSec: 0, width: 0, height: 0 };
  let thumbDataUrl = "";
  try {
    probe = await probeVideoBlob(file);
    assertVideoFitsSealLimits(file.size, probe.durationSec);
    thumbDataUrl = await extractVideoFirstFrameThumb(file);
  } catch (error) {
    if (error instanceof Error && error.message === SEAL_VIDEO_TOO_LARGE) throw error;
  }

  registerVideoFileHandle(id, file);

  return {
    id,
    name: file.name || "Video",
    mimeType: file.type || "video/mp4",
    size: file.size,
    durationSec: probe.durationSec || undefined,
    width: probe.width || undefined,
    height: probe.height || undefined,
    thumbDataUrl: thumbDataUrl || undefined,
    videoPending: true,
  };
}

export function buildPendingVideoRef(
  row: ComposerAttachmentRow | VideoComposerLightRow,
  opts: { coverOnly?: boolean } = {}
): VideoAttachmentRef {
  const coverOnly = Boolean(opts.coverOnly);
  if (coverOnly) {
    clearVideoFileHandle(String(row.id || ""));
  } else {
    const file = (row as ComposerAttachmentRow).file;
    if (file instanceof File) {
      registerVideoFileHandle(String(row.id || ""), file);
    }
  }

  return {
    id: String(row.id || ""),
    name: row.name,
    mimeType: String(row.mimeType || "video/mp4"),
    size: Number(row.size || 0),
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    thumbDataUrl: row.thumbDataUrl,
    videoBlobRef: true,
    chunkCount: 0,
    videoPending: !coverOnly,
    coverOnly: coverOnly || undefined,
  };
}

export function attachmentsForLightVideoSeal(attachments: unknown[] = []): unknown[] {
  const out: unknown[] = [];
  for (const row of attachments) {
    if (!row || typeof row !== "object") continue;
    const mime = String((row as ComposerAttachmentRow).mimeType || "");
    if (!isVideoMimeType(mime) && !isVideoAttachmentRef(row) && !isVideoComposerLightRow(row)) {
      out.push(row);
      continue;
    }
    out.push(buildPendingVideoRef(row as ComposerAttachmentRow, { coverOnly: true }));
  }
  return out;
}

/** Draft / relay rows — never include File/Blob/previewUrl. */
export function composerAttachmentsForDraft(
  attachments: Array<ComposerAttachmentRow | VideoComposerLightRow | VideoAttachmentRef> = []
): ComposerAttachmentRow[] {
  return attachments.map((raw) => {
    const row = raw as ComposerAttachmentRow;
    if (isVideoAttachmentRef(raw)) {
      const ref = raw as VideoAttachmentRef;
      return {
        id: ref.id,
        name: ref.name,
        mimeType: ref.mimeType,
        size: ref.size,
        durationSec: ref.durationSec,
        width: ref.width,
        height: ref.height,
        thumbDataUrl: ref.thumbDataUrl,
        videoBlobRef: true,
        chunkCount: ref.chunkCount,
        videoPending: ref.videoPending,
        coverOnly: ref.coverOnly,
      } as ComposerAttachmentRow;
    }
    if (isVideoComposerLightRow(raw) || isVideoMimeType(String(row.mimeType || ""))) {
      return {
        id: row.id,
        name: row.name,
        mimeType: row.mimeType,
        size: row.size,
        durationSec: row.durationSec,
        width: row.width,
        height: row.height,
        thumbDataUrl: row.thumbDataUrl,
        videoPending: true,
        coverOnly: row.coverOnly,
      };
    }
    const next: ComposerAttachmentRow = {
      id: row.id,
      name: row.name,
      mimeType: row.mimeType,
      size: row.size,
    };
    if (typeof row.dataUrl === "string" && row.dataUrl) next.dataUrl = row.dataUrl;
    return next;
  });
}

export function draftHasVideoAttachment(attachments: unknown[] = []): boolean {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((row) => {
    if (!row || typeof row !== "object") return false;
    if (isVideoAttachmentRef(row) || isVideoComposerLightRow(row)) return true;
    return isVideoMimeType(String((row as ComposerAttachmentRow).mimeType || ""));
  });
}

export function draftHasPendingFullVideo(attachments: unknown[] = []): boolean {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((row) => {
    if (isVideoPendingRef(row)) return true;
    if (isVideoComposerLightRow(row) && !row.coverOnly) return true;
    return false;
  });
}

/** Meter: thumb-only for pending video; cap checks use logical `size`. */
export function attachmentRowByteSize(
  row: unknown,
  opts: { meterOnly?: boolean } = {}
): number {
  if (!row || typeof row !== "object") return 0;
  if (isVideoAttachmentRef(row)) {
    if (opts.meterOnly && (row.videoPending || row.chunkCount === 0)) {
      return estimateThumbBytes(row);
    }
    return Number(row.size || 0);
  }
  if (isVideoComposerLightRow(row)) {
    if (opts.meterOnly) return estimateThumbBytes(row);
    return Number(row.size || 0);
  }
  const typed = row as ComposerAttachmentRow;
  const mime = String(typed.mimeType || "");
  if (isVideoMimeType(mime)) {
    if (opts.meterOnly) return estimateThumbBytes(typed);
    return Number(typed.size || 0);
  }
  const dataUrl = typed.dataUrl;
  if (typeof dataUrl === "string" && dataUrl.length > 0) {
    return Math.ceil((dataUrl.length * 3) / 4);
  }
  return Number(typed.size || 0);
}

export function logicalAttachmentBytes(row: unknown): number {
  return attachmentRowByteSize(row, { meterOnly: false });
}

export function meterAttachmentBytes(row: unknown): number {
  return attachmentRowByteSize(row, { meterOnly: true });
}
