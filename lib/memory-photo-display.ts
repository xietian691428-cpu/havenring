/**
 * Cross-device safe photo URL resolution for memory UI + Pair import.
 * blob: and previewUrl from another session/device are never used.
 */

type PhotoLike = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  previewUrl?: string;
  src?: string;
  url?: string;
};

export function resolveMemoryPhotoUrl(photo: unknown): string {
  if (typeof photo === "string") {
    const value = photo.trim();
    if (isDisplayableImageUrl(value)) return value;
    return "";
  }
  if (!photo || typeof photo !== "object") return "";
  const row = photo as PhotoLike;
  const candidates = [row.dataUrl, row.src, row.url, row.previewUrl];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isDisplayableImageUrl(candidate)) {
      return candidate;
    }
  }
  return "";
}

function isDisplayableImageUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("blob:")) return false;
  if (value.startsWith("data:image/")) return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  return false;
}

function isPortableInlineUrl(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("blob:")) return false;
  if (value.startsWith("data:")) return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  return false;
}

export function resolveMemoryAttachmentUrl(item: unknown): string {
  if (typeof item === "string") {
    const value = item.trim();
    return isPortableInlineUrl(value) ? value : "";
  }
  if (!item || typeof item !== "object") return "";
  const row = item as PhotoLike;
  const candidates = [row.dataUrl, row.src, row.url, row.previewUrl];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && isPortableInlineUrl(candidate)) {
      return candidate;
    }
  }
  return "";
}

export function countDisplayablePhotos(photos: unknown): number {
  const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
  return rows.filter((row) => resolveMemoryPhotoUrl(row)).length;
}

export type StoredMemoryPhoto = {
  id: string;
  name?: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

/** Keep only portable inline image rows (data URL or remote URL). */
export function normalizePhotosForStorage(photos: unknown): StoredMemoryPhoto[] | null {
  const rows = Array.isArray(photos) ? photos : photos ? [photos] : [];
  const normalized: StoredMemoryPhoto[] = [];
  for (const row of rows) {
    const dataUrl = resolveMemoryPhotoUrl(row);
    if (!dataUrl) continue;
    const meta = row && typeof row === "object" ? (row as PhotoLike) : {};
    normalized.push({
      id: String(meta.id || crypto.randomUUID()),
      name: meta.name,
      mimeType: String(meta.mimeType || "image/jpeg"),
      size:
        Number(meta.size || 0) ||
        (dataUrl.startsWith("data:") ? Math.ceil((dataUrl.length * 3) / 4) : 0),
      dataUrl,
    });
  }
  return normalized.length ? normalized : null;
}

export function normalizeAttachmentsForStorage(
  attachments: unknown
): Array<StoredMemoryPhoto & { name?: string }> | null {
  const rows = Array.isArray(attachments) ? attachments : [];
  const normalized: Array<StoredMemoryPhoto & { name?: string }> = [];
  for (const row of rows) {
    const dataUrl = resolveMemoryAttachmentUrl(row);
    if (!dataUrl) continue;
    const meta = row && typeof row === "object" ? (row as PhotoLike) : {};
    normalized.push({
      id: String(meta.id || crypto.randomUUID()),
      name: meta.name,
      mimeType: String(meta.mimeType || "application/octet-stream"),
      size:
        Number(meta.size || 0) ||
        (dataUrl.startsWith("data:") ? Math.ceil((dataUrl.length * 3) / 4) : 0),
      dataUrl,
    });
  }
  return normalized.length ? normalized : null;
}
