import { SEAL_LOCAL_MAX_BYTES } from "@/lib/seal-staging-shared";
import {
  MAX_MEMORY_WITH_VIDEO_MB,
  MAX_VIDEO_ATTACHMENT_BYTES,
  MAX_VIDEO_ATTACHMENT_MB,
} from "@/lib/seal-local-limits";

export {
  MAX_MEMORY_WITH_VIDEO_MB,
  MAX_VIDEO_ATTACHMENT_BYTES,
  MAX_VIDEO_ATTACHMENT_MB,
};

/** Per-file ceiling for documents / audio attachments. */
export const MAX_FILE_ATTACHMENT_BYTES = 100 * 1024 * 1024;

export const MAX_FILE_ATTACHMENT_MB = Math.floor(
  MAX_FILE_ATTACHMENT_BYTES / (1024 * 1024)
);

export const SEAL_LOCAL_MAX_MB = Math.floor(SEAL_LOCAL_MAX_BYTES / (1024 * 1024));

/** Shown in composer — bump when media/seal limits change (cache-bust check). */
export const COMPOSER_MEDIA_SEAL_REV = "2026-06-video-light";

export function isVideoMimeType(mime: string): boolean {
  return String(mime || "")
    .toLowerCase()
    .startsWith("video/");
}

export function maxAttachmentBytesForMime(mime: string): number {
  return isVideoMimeType(mime)
    ? MAX_VIDEO_ATTACHMENT_BYTES
    : MAX_FILE_ATTACHMENT_BYTES;
}

export function maxAttachmentMbForMime(mime: string): number {
  return isVideoMimeType(mime) ? MAX_VIDEO_ATTACHMENT_MB : MAX_FILE_ATTACHMENT_MB;
}
