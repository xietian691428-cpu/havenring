/**
 * Timeline list rows — keep one thumbnail per memory to reduce WebKit heap on iOS.
 * Full media loads on Memory detail via getMemoryById.
 */

type PhotoRow = string | { dataUrl?: string; previewUrl?: string; src?: string; url?: string };

function firstPhotoUrl(photo: unknown): string {
  const raw = Array.isArray(photo) ? photo : photo ? [photo] : [];
  const first = raw[0] as PhotoRow | undefined;
  if (!first) return "";
  if (typeof first === "string") return first;
  return first.dataUrl || first.previewUrl || first.src || first.url || "";
}

export function slimMemoryForTimelineList<T extends { photo?: unknown }>(memory: T): T {
  const url = firstPhotoUrl(memory.photo);
  if (!url) {
    return { ...memory, photo: null };
  }
  return {
    ...memory,
    photo: [{ id: `${String((memory as { id?: string }).id || "m")}-thumb`, dataUrl: url }],
  };
}
