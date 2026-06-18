import { compressImageBuffer } from "@/lib/image-compressor-client";
import { getComposerSaveLimits, isIosWebKit } from "@/lib/composer-platform-limits";

export type ComposerPhotoRow = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: number;
  previewUrl?: string;
  blob?: Blob;
  dataUrl?: string;
};

export function getComposerPhotoDisplayUrl(photo: ComposerPhotoRow | null | undefined): string {
  if (!photo) return "";
  if (typeof photo.previewUrl === "string" && photo.previewUrl) return photo.previewUrl;
  if (typeof photo.dataUrl === "string" && photo.dataUrl) return photo.dataUrl;
  return "";
}

export function revokeComposerPhoto(photo: ComposerPhotoRow | null | undefined): void {
  if (!photo?.previewUrl || typeof URL === "undefined") return;
  try {
    URL.revokeObjectURL(photo.previewUrl);
  } catch {
    /* ignore */
  }
}

export function revokeComposerPhotos(photos: ComposerPhotoRow[] = []): void {
  for (const photo of photos) revokeComposerPhoto(photo);
}

export function createComposerPhotoFromBlob(
  blob: Blob,
  id: string
): ComposerPhotoRow {
  const previewUrl =
    typeof URL !== "undefined" ? URL.createObjectURL(blob) : undefined;
  return {
    id,
    mimeType: blob.type || "image/jpeg",
    size: blob.size,
    previewUrl,
    blob,
  };
}

export async function blobToDataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read media."));
    reader.readAsDataURL(blob);
  });
}

function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/** Re-compress before persist to keep iOS WebKit under memory limits. */
async function blobToPersistDataUrl(blob: Blob): Promise<string> {
  const limits = getComposerSaveLimits();
  let source = blob;
  if (isIosWebKit() || blob.size > limits.recompressAboveBytes) {
    try {
      const buffer = await blob.arrayBuffer();
      source = await compressImageBuffer(buffer, blob.type || "image/jpeg", {
        maxDim: limits.imageMaxDim,
        quality: limits.jpegQuality,
      });
    } catch {
      /* keep original */
    }
  }
  return blobToDataUrlFromBlob(source);
}

/** Draft rows: blobs only — avoids base64 spike before timeline encrypt. */
export function composerPhotosForDraft(
  photos: ComposerPhotoRow[] = []
): ComposerPhotoRow[] {
  return photos.map((photo) => {
    const row: ComposerPhotoRow = {
      id: photo.id,
      name: photo.name,
      mimeType: photo.mimeType,
      size: photo.size,
    };
    if (photo.blob instanceof Blob) row.blob = photo.blob;
    if (typeof photo.dataUrl === "string" && photo.dataUrl) row.dataUrl = photo.dataUrl;
    return row;
  });
}

/** Resolve composer blob previews to inline data URLs for seal size fitting. */
export async function resolveComposerMediaRowForSeal(
  row: unknown
): Promise<{
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
}> {
  if (!row || typeof row !== "object") return {};
  const typed = row as ComposerPhotoRow;
  if (typeof typed.dataUrl === "string" && typed.dataUrl) {
    return {
      id: typed.id,
      name: typed.name,
      mimeType: typed.mimeType,
      size: typed.size,
      dataUrl: typed.dataUrl,
    };
  }
  if (typed.blob instanceof Blob) {
    const dataUrl = await blobToPersistDataUrl(typed.blob);
    return {
      id: typed.id,
      name: typed.name,
      mimeType: typed.mimeType || typed.blob.type || "image/jpeg",
      size: typed.blob.size || typed.size,
      dataUrl,
    };
  }
  return {
    id: typed.id,
    name: typed.name,
    mimeType: typed.mimeType,
    size: typed.size,
  };
}

export async function prepareComposerPhotosForSave(
  photos: ComposerPhotoRow[] = [],
  blobToDataUrl?: (blob: Blob) => Promise<string>
): Promise<
  Array<{
    id: string;
    name?: string;
    mimeType?: string;
    size?: number;
    dataUrl: string;
  }>
> {
  const toDataUrl = blobToDataUrl ?? blobToPersistDataUrl;
  const prepared = [];
  for (const photo of photos) {
    if (typeof photo?.dataUrl === "string" && photo.dataUrl) {
      prepared.push({
        id: photo.id,
        name: photo.name,
        mimeType: photo.mimeType,
        size: photo.size,
        dataUrl: photo.dataUrl,
      });
      await yieldToMain();
      continue;
    }
    if (!photo?.blob) continue;
    const dataUrl = await toDataUrl(photo.blob);
    prepared.push({
      id: photo.id,
      name: photo.name,
      mimeType: photo.mimeType || "image/jpeg",
      size: photo.blob.size || photo.size,
      dataUrl,
    });
    await yieldToMain();
  }
  return prepared.filter((row) => row.dataUrl);
}
