import { compressImageBuffer } from "@/lib/image-compressor-client";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import {
  PHOTO_BLOB_DIMS,
  type MemoryPhotoRef,
  type PhotoBlobType,
  type PreparedComposerPhoto,
} from "@/lib/memory-photo-types";

function yieldToMain(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

async function readImageDimensions(blob: Blob): Promise<{ w: number; h: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const dims = { w: bitmap.width, h: bitmap.height };
      bitmap.close();
      return dims;
    } catch {
      /* fall through */
    }
  }
  if (typeof document === "undefined") return { w: 0, h: 0 };
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      URL.revokeObjectURL(url);
      img.src = "";
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ w: 0, h: 0 });
    };
    img.src = url;
  });
}

async function samplePlaceholderColor(blob: Blob): Promise<string> {
  if (typeof document === "undefined") return "#3d3530";
  try {
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("placeholder-failed"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      img.src = "";
      return "#3d3530";
    }
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    URL.revokeObjectURL(url);
    img.src = "";
    canvas.width = 0;
    canvas.height = 0;
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return "#3d3530";
  }
}

async function compressVariant(
  buffer: ArrayBuffer,
  mimeType: string,
  type: PhotoBlobType
): Promise<Blob> {
  const quality = type === "thumb" ? 0.72 : type === "medium" ? 0.74 : 0.76;
  return compressImageBuffer(buffer.slice(0), mimeType, {
    maxDim: PHOTO_BLOB_DIMS[type],
    quality,
  });
}

/** Build thumb / medium / full JPEG variants from one source blob. */
export async function buildPhotoBlobVariants(source: Blob): Promise<{
  blobs: Record<PhotoBlobType, Blob>;
  w: number;
  h: number;
  placeholder: string;
}> {
  const mimeType = source.type || "image/jpeg";
  const buffer = await source.arrayBuffer();
  const sequential = isIosWebKit();
  const blobs = {} as Record<PhotoBlobType, Blob>;

  if (sequential) {
    blobs.full = await compressVariant(buffer, mimeType, "full");
    await yieldToMain();
    const mediumBuf = await blobs.full.arrayBuffer();
    blobs.medium = await compressVariant(mediumBuf, mimeType, "medium");
    await yieldToMain();
    const thumbBuf = await blobs.medium.arrayBuffer();
    blobs.thumb = await compressVariant(thumbBuf, mimeType, "thumb");
  } else {
    const [thumb, medium, full] = await Promise.all([
      compressVariant(buffer, mimeType, "thumb"),
      compressVariant(buffer, mimeType, "medium"),
      compressVariant(buffer, mimeType, "full"),
    ]);
    blobs.thumb = thumb;
    blobs.medium = medium;
    blobs.full = full;
  }

  const { w, h } = await readImageDimensions(blobs.full);
  const placeholder = await samplePlaceholderColor(blobs.thumb);
  return { blobs, w, h, placeholder };
}

export async function buildPreparedComposerPhoto(
  photo: { id: string; name?: string; mimeType?: string; size?: number; blob?: Blob; dataUrl?: string }
): Promise<PreparedComposerPhoto | null> {
  let source: Blob | null = null;
  if (photo.blob instanceof Blob) {
    source = photo.blob;
  } else if (typeof photo.dataUrl === "string" && photo.dataUrl) {
    try {
      source = await fetch(photo.dataUrl).then((res) => res.blob());
    } catch {
      return null;
    }
  }
  if (!source) return null;

  const { blobs, w, h, placeholder } = await buildPhotoBlobVariants(source);
  const ref: MemoryPhotoRef = {
    id: photo.id,
    name: photo.name,
    mimeType: blobs.full.type || photo.mimeType || "image/jpeg",
    size: blobs.full.size || photo.size,
    w: w || undefined,
    h: h || undefined,
    placeholder,
  };
  return { ref, blobs };
}
