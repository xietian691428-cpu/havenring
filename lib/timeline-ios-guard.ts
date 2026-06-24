import { isIosWebKit } from "@/lib/composer-platform-limits";

function isAndroidWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent || "");
}

function isMobileMemorySensitive(): boolean {
  return isIosWebKit() || isAndroidWeb();
}

export { isMobileMemorySensitive, isIosWebKit };

/** Timeline list page size (infinite scroll chunk). */
export function getTimelinePageSize(): number {
  if (isIosWebKit()) return 6;
  return isMobileMemorySensitive() ? 15 : 30;
}

/** Persisted + list thumbnail max edge (px). */
export function getTimelineThumbMaxDim(): number {
  return isMobileMemorySensitive() ? 300 : 320;
}

/** Persisted medium preview max edge (px) — detail warm cache. */
export function getTimelineMediumMaxDim(): number {
  return isMobileMemorySensitive() ? 800 : 960;
}

/** In-memory Object URL cap (visible viewport only). */
export function getTimelineThumbCacheMax(): number {
  return isIosWebKit() ? 3 : isMobileMemorySensitive() ? 6 : 16;
}

/** TanStack Virtual overscan rows. */
export function getTimelineVirtualOverscan(): number {
  return isIosWebKit() ? 0 : isMobileMemorySensitive() ? 1 : 3;
}

export function getTimelineStoryPreviewMaxChars(): number {
  return isMobileMemorySensitive() ? 120 : 280;
}

/** Max persisted thumb rows in IndexedDB (LRU). */
export function getTimelinePersistedThumbMax(): number {
  return isIosWebKit() ? 48 : isMobileMemorySensitive() ? 60 : 200;
}

/** Min ms between pull-to-refresh sync on mobile WebKit. */
export function getTimelinePullRefreshCooldownMs(): number {
  return isMobileMemorySensitive() ? 5000 : 1500;
}

/** iOS memory pressure poll interval (ms). */
export function getTimelineMemoryPollMs(): number {
  return isIosWebKit() ? 4000 : 8000;
}
