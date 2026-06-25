/** Timeline defers decoding inline / large photo blobs above this size. */
export const TIMELINE_LARGE_BLOB_BYTES = 5 * 1024 * 1024;

type MediaRow = {
  size?: number;
  dataUrl?: string;
  blobs?: Record<string, Blob>;
  ref?: { id?: string };
};

export function estimatePhotoPayloadBytes(photo: unknown): number {
  if (photo == null) return 0;
  const rows = Array.isArray(photo) ? photo : [photo];
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const obj = row as MediaRow;
    const size = Number(obj.size || 0);
    if (size > 0) {
      total += size;
      continue;
    }
    const dataUrl = typeof obj.dataUrl === "string" ? obj.dataUrl : "";
    if (dataUrl.length > 0) {
      total += Math.ceil((dataUrl.length * 3) / 4);
      continue;
    }
    const blobs = obj.blobs;
    if (blobs && typeof blobs === "object") {
      for (const blob of Object.values(blobs)) {
        if (blob instanceof Blob) total += blob.size;
      }
    }
  }
  return total;
}

export function photoPayloadHasLargeBlob(photo: unknown): boolean {
  return estimatePhotoPayloadBytes(photo) >= TIMELINE_LARGE_BLOB_BYTES;
}
