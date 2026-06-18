/**
 * Timeline image resize — routes through imageCompressor.worker (off main thread).
 */
import { compressImageBuffer } from "@/lib/image-compressor-client";

export type TimelineResizeOpts = {
  maxDim: number;
  quality?: number;
};

export async function resizeImageBytesInWorker(
  buffer: ArrayBuffer,
  mimeType: string,
  opts: TimelineResizeOpts
): Promise<Blob> {
  return compressImageBuffer(buffer, mimeType, {
    maxDim: opts.maxDim,
    quality: opts.quality ?? 0.72,
  });
}

/** Fetch data URL → ArrayBuffer → worker resize (avoids main-thread canvas). */
export async function resizeImageDataUrlInWorker(
  dataUrl: string,
  opts: TimelineResizeOpts
): Promise<Blob | null> {
  if (!dataUrl) return null;
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    return await resizeImageBytesInWorker(buffer, blob.type || "image/jpeg", opts);
  } catch {
    return null;
  }
}
