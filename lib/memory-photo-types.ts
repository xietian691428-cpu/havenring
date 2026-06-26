/** Reference stored in encrypted `photoEnc` — no inline base64. */
export type MemoryPhotoRef = {
  id: string;
  w?: number;
  h?: number;
  placeholder?: string;
  mimeType?: string;
  size?: number;
  name?: string;
};

export type PhotoBlobType = "thumb" | "medium" | "full";

export const PHOTO_BLOB_DIMS: Record<PhotoBlobType, number> = {
  thumb: 300,
  medium: 800,
  full: 1280,
};

export type PreparedComposerPhoto = {
  ref: MemoryPhotoRef;
  blobs: Record<PhotoBlobType, Blob>;
};

export type PhotoBlobRecord = {
  id: string;
  photoId: string;
  memoryId: string;
  type: PhotoBlobType;
  size: number;
  mimeType: string;
  data: Blob;
};

export function photoBlobStoreId(photoId: string, type: PhotoBlobType): string {
  return `${photoId}:${type}`;
}

/** Memory-scoped blob key — prevents cross-memory / cross-ring photo bleed. */
export function scopedPhotoBlobStoreId(
  memoryId: string,
  photoId: string,
  type: PhotoBlobType
): string {
  return `${memoryId}:${photoId}:${type}`;
}

export function parsePhotoBlobStoreId(id: string): { photoId: string; type: PhotoBlobType } | null {
  const idx = id.lastIndexOf(":");
  if (idx <= 0) return null;
  const photoId = id.slice(0, idx);
  const type = id.slice(idx + 1) as PhotoBlobType;
  if (type !== "thumb" && type !== "medium" && type !== "full") return null;
  return { photoId, type };
}

/** Composer draft row with inline blob or data URL — not a persisted vault ref. */
export function isComposerPhotoBlobRow(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const typed = row as { blob?: unknown; dataUrl?: string };
  if (typed.blob instanceof Blob) return true;
  const dataUrl = typeof typed.dataUrl === "string" ? typed.dataUrl : "";
  return Boolean(dataUrl && dataUrl.startsWith("data:image/"));
}

export function isMemoryPhotoRef(row: unknown): row is MemoryPhotoRef {
  if (!row || typeof row !== "object") return false;
  if (isPreparedComposerPhoto(row)) return false;
  if (isComposerPhotoBlobRow(row)) return false;
  const typed = row as MemoryPhotoRef & { dataUrl?: string };
  return typeof typed.id === "string" && !typed.dataUrl;
}

export function photoRowHasInlineDataUrl(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const typed = row as { dataUrl?: string; src?: string; url?: string };
  const candidate = typed.dataUrl || typed.src || typed.url || "";
  return typeof candidate === "string" && candidate.startsWith("data:image/");
}

export function photosHaveInlineDataUrls(photos: unknown): boolean {
  const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
  return rows.some((row) => photoRowHasInlineDataUrl(row));
}

export function firstPhotoRef(photos: unknown): MemoryPhotoRef | null {
  const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
  for (const row of rows) {
    if (isMemoryPhotoRef(row)) return row;
    if (row && typeof row === "object" && typeof (row as MemoryPhotoRef).id === "string") {
      const typed = row as MemoryPhotoRef & { dataUrl?: string };
      if (!typed.dataUrl) return typed;
    }
  }
  return null;
}

export function isPreparedComposerPhoto(row: unknown): row is PreparedComposerPhoto {
  if (!row || typeof row !== "object") return false;
  const typed = row as PreparedComposerPhoto;
  return (
    Boolean(typed.ref?.id) &&
    typed.blobs != null &&
    typed.blobs.thumb instanceof Blob &&
    typed.blobs.medium instanceof Blob &&
    typed.blobs.full instanceof Blob
  );
}
