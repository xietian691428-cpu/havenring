import { isIosWebKit } from "@/lib/composer-platform-limits";

function isAndroidWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

function isMobileMemorySensitive(): boolean {
  return isIosWebKit() || isAndroidWeb();
}

/** Timeline page size — smaller first paint on iOS WebKit. */
export function getTimelinePageSize(): number {
  return isMobileMemorySensitive() ? 25 : 30;
}

/** Max edge length for timeline thumbnails. */
export function getTimelineThumbMaxDim(): number {
  return isMobileMemorySensitive() ? 240 : 320;
}

/** In-memory object URL cache cap (visible rows + overscan). */
export function getTimelineThumbCacheMax(): number {
  return isMobileMemorySensitive() ? 10 : 16;
}

/** Virtual list overscan row count. */
export function getTimelineVirtualOverscan(): number {
  return isMobileMemorySensitive() ? 2 : 3;
}

export function getTimelineStoryPreviewMaxChars(): number {
  return isMobileMemorySensitive() ? 160 : 280;
}

/** Max persisted JPEG thumbs in IndexedDB (LRU prune on write). */
export function getTimelinePersistedThumbMax(): number {
  return isMobileMemorySensitive() ? 120 : 200;
}
