import {
  getTimelineMediumMaxDim,
  getTimelineThumbMaxDim,
  getTimelineThumbQuality,
} from "@/lib/timeline-ios-guard";
import { resizeImageDataUrlInWorker } from "@/lib/timeline-image-worker-client";

/** Decode an inline image to a small JPEG blob (worker first, canvas fallback). */
export async function dataUrlToTimelineThumbBlob(
  dataUrl: string,
  maxDim = getTimelineThumbMaxDim()
): Promise<Blob | null> {
  if (!dataUrl) return null;

  const fromWorker = await resizeImageDataUrlInWorker(dataUrl, {
    maxDim,
    quality: getTimelineThumbQuality(),
  });
  if (fromWorker) return fromWorker;

  if (typeof document === "undefined") return null;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("thumb-decode-failed"));
    el.src = dataUrl;
  });
  const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    return null;
  }
  ctx.drawImage(img, 0, 0, width, height);
  img.src = "";
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      getTimelineThumbQuality()
    );
  });
}

/** Generate thumb + medium JPEG blobs for persistence. */
export async function dataUrlToTimelineMediaBlobs(dataUrl: string): Promise<{
  thumb: Blob | null;
  medium: Blob | null;
}> {
  if (!dataUrl) return { thumb: null, medium: null };
  const thumbDim = getTimelineThumbMaxDim();
  const mediumDim = getTimelineMediumMaxDim();
  const thumbQ = getTimelineThumbQuality();
  const thumb = await resizeImageDataUrlInWorker(dataUrl, {
    maxDim: thumbDim,
    quality: thumbQ,
  });
  const medium = await resizeImageDataUrlInWorker(dataUrl, {
    maxDim: mediumDim,
    quality: Math.min(0.78, thumbQ + 0.12),
  });
  if (thumb && medium) return { thumb, medium };
  const thumbFallback = thumb || (await dataUrlToTimelineThumbBlob(dataUrl, thumbDim));
  const mediumFallback =
    medium || (await dataUrlToTimelineThumbBlob(dataUrl, mediumDim));
  return { thumb: thumbFallback, medium: mediumFallback };
}

export function firstPhotoDataUrl(photo: unknown): string | null {
  const raw = Array.isArray(photo) ? photo : photo ? [photo] : [];
  const first = raw[0];
  if (!first) return null;
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null) {
    const row = first as { dataUrl?: string; previewUrl?: string; src?: string; url?: string };
    return row.dataUrl || row.previewUrl || row.src || row.url || null;
  }
  return null;
}
