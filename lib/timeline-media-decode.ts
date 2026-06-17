import { getTimelineThumbMaxDim } from "@/lib/timeline-ios-guard";

/** Decode an inline image to a small JPEG blob (release source strings ASAP). */
export async function dataUrlToTimelineThumbBlob(
  dataUrl: string,
  maxDim = getTimelineThumbMaxDim()
): Promise<Blob | null> {
  if (!dataUrl || typeof document === "undefined") return null;
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
      0.72
    );
  });
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
