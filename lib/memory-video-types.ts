/** Video attachment refs — ciphertext-sized metadata in memory row; bytes in videoChunks store. */

export const VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;

export type VideoChunkRecord = {
  id: string;
  memoryId: string;
  attachmentId: string;
  chunkIndex: number;
  chunkCount: number;
  mimeType: string;
  size: number;
  data: Blob;
};

export type VideoAttachmentRef = {
  id: string;
  name?: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  width?: number;
  height?: number;
  thumbDataUrl?: string;
  videoBlobRef: true;
  chunkCount: number;
  /** Bytes not yet chunked — File handle lives in video-file-handle-store. */
  videoPending?: boolean;
  /** Light seal: text + cover thumb only, no full clip. */
  coverOnly?: boolean;
};

export type VideoComposerLightRow = {
  id: string;
  name?: string;
  mimeType: string;
  size: number;
  durationSec?: number;
  width?: number;
  height?: number;
  thumbDataUrl?: string;
  videoPending: true;
  coverOnly?: boolean;
};

export function videoChunkStoreId(
  memoryId: string,
  attachmentId: string,
  chunkIndex: number
): string {
  return `${memoryId}:${attachmentId}:${chunkIndex}`;
}

export function isVideoAttachmentRef(row: unknown): row is VideoAttachmentRef {
  return (
    Boolean(row) &&
    typeof row === "object" &&
    (row as VideoAttachmentRef).videoBlobRef === true &&
    typeof (row as VideoAttachmentRef).chunkCount === "number"
  );
}

export function isVideoPendingRef(row: unknown): row is VideoAttachmentRef {
  return (
    isVideoAttachmentRef(row) &&
    !row.coverOnly &&
    (row.videoPending === true || row.chunkCount === 0)
  );
}

export function isVideoComposerLightRow(row: unknown): row is VideoComposerLightRow {
  return (
    Boolean(row) &&
    typeof row === "object" &&
    (row as VideoComposerLightRow).videoPending === true &&
    isVideoMimeType(String((row as VideoComposerLightRow).mimeType || ""))
  );
}

export function isVideoMimeType(mime: string): boolean {
  return String(mime || "")
    .toLowerCase()
    .startsWith("video/");
}
