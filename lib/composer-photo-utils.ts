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

export async function prepareComposerPhotosForSave(
  photos: ComposerPhotoRow[] = [],
  blobToDataUrl: (blob: Blob) => Promise<string>
): Promise<
  Array<{
    id: string;
    name?: string;
    mimeType?: string;
    size?: number;
    dataUrl: string;
  }>
> {
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
      continue;
    }
    if (!photo?.blob) continue;
    const dataUrl = await blobToDataUrl(photo.blob);
    prepared.push({
      id: photo.id,
      name: photo.name,
      mimeType: photo.mimeType || "image/jpeg",
      size: photo.blob.size || photo.size,
      dataUrl,
    });
  }
  return prepared.filter((row) => row.dataUrl);
}
