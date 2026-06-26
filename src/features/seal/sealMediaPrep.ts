import { resolveComposerMediaRowForSeal } from "@/lib/composer-photo-utils";
import {
  SEAL_LOCAL_MAX_BYTES,
  SEAL_STAGING_MAX_BYTES,
  resolveSealStagingPlaintextMaxBytes,
} from "@/lib/seal-staging-shared";
import {
  draftHasVideoAttachment,
  logicalAttachmentBytes,
  meterAttachmentBytes,
} from "@/lib/video-attachment-prep";
import { isVideoAttachmentRef, isVideoMimeType } from "@/lib/memory-video-types";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { estimateOomRisk } from "@/lib/ios-memory-heuristics";
import {
  MAX_MEMORY_WITH_VIDEO_BYTES,
  MAX_MEMORY_WITH_VIDEO_MB,
  MAX_VIDEO_ATTACHMENT_BYTES,
  VIDEO_HEADROOM_WARN_BYTES,
  VIDEO_HEADROOM_WARN_MB,
} from "@/lib/seal-local-limits";
import {
  throwSealLocalStorageFull,
  throwSealVideoTooLarge,
} from "./sealUserMessages";
import type { SealDraftFinalizePayload } from "./sealTypes";
import {
  readStorageEstimate,
} from "@/lib/storage-quota";

type MediaRow = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
};

function estimateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function isImageMime(mime: string): boolean {
  return String(mime || "").toLowerCase().startsWith("image/");
}

async function compressImageDataUrl(
  dataUrl: string,
  maxDim: number,
  quality: number
): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not compress image."));
    img.src = dataUrl;
  });
}

async function compressMediaRow(
  row: MediaRow,
  pass: number
): Promise<MediaRow | null> {
  const dataUrl = typeof row.dataUrl === "string" ? row.dataUrl : "";
  if (!dataUrl) {
    return {
      id: row.id,
      name: row.name,
      mimeType: row.mimeType,
      size: row.size,
    };
  }
  if (!isImageMime(String(row.mimeType || ""))) {
    return row;
  }
  const maxDim = pass === 0 ? 2400 : pass === 1 ? 1800 : 1280;
  const quality = pass === 0 ? 0.82 : pass === 1 ? 0.72 : 0.62;
  try {
    const nextUrl = await compressImageDataUrl(dataUrl, maxDim, quality);
    return {
      ...row,
      mimeType: "image/jpeg",
      dataUrl: nextUrl,
      size: Math.ceil((nextUrl.length * 3) / 4),
    };
  } catch {
    return row;
  }
}

export async function fitMediaItemsToBudget(
  items: unknown[],
  budgetBytes: number
): Promise<unknown[]> {
  if (!Array.isArray(items) || budgetBytes <= 0) return [];
  let working = await Promise.all(
    items
      .filter((row) => row && typeof row === "object")
      .map((row) => resolveComposerMediaRowForSeal(row))
  );

  for (let pass = 0; pass < 3; pass += 1) {
    const next: MediaRow[] = [];
    let remaining = budgetBytes;
    for (const row of working) {
      const candidate =
        pass > 0 && isImageMime(String(row.mimeType || ""))
          ? await compressMediaRow(row, pass)
          : row;
      if (!candidate) continue;
      const slim = {
        id: candidate.id,
        name: candidate.name,
        mimeType: candidate.mimeType,
        size: candidate.size,
        dataUrl:
          typeof candidate.dataUrl === "string" ? candidate.dataUrl : undefined,
      };
      const bytes = estimateJsonBytes(slim);
      if (bytes > remaining) continue;
      remaining -= bytes;
      next.push(slim);
    }
    working = next;
    if (estimateJsonBytes(working) <= budgetBytes) break;
  }
  return working;
}

export async function buildSealPayloadFromDraft(
  item: {
    id: string;
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  } | null,
  opts: { maxBytes?: number; forServerCommit?: boolean; skipMediaFit?: boolean } = {}
): Promise<SealDraftFinalizePayload | null> {
  if (!item?.id) return null;
  const maxBytes = opts.maxBytes ?? SEAL_LOCAL_MAX_BYTES;
  const base = {
    id: item.id,
    title: String(item.title || "Untitled memory"),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
  };

  if (opts.skipMediaFit) {
    return {
      ...base,
      photo: Array.isArray(item.photo) ? item.photo : [],
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
    };
  }

  const mediaBudget = Math.max(
    64 * 1024,
    maxBytes - estimateJsonBytes({ ...base, photo: [], attachments: [] })
  );
  const photo = await fitMediaItemsToBudget(
    Array.isArray(item.photo) ? item.photo : [],
    Math.floor(mediaBudget * 0.65)
  );
  const attachments = await fitMediaItemsToBudget(
    Array.isArray(item.attachments) ? item.attachments : [],
    Math.floor(mediaBudget * 0.35)
  );
  const payload: SealDraftFinalizePayload = { ...base, photo, attachments };
  if (opts.forServerCommit) {
    return toServerSealCommitPayload(payload);
  }
  if (estimateJsonBytes(payload) > maxBytes) {
    const tighter = await buildSealPayloadFromDraft(item, {
      maxBytes: Math.floor(maxBytes * 0.85),
      forServerCommit: false,
    });
    return tighter;
  }
  return payload;
}

/**
 * Staging upload handoff — draft ids + text only.
 * Local IDB draft + seal relay hold full media (local-first).
 */
export function buildSealStagingHandoffPayload(item: {
  id: string;
  title?: string;
  story?: string;
  releaseAt?: number;
}): SealDraftFinalizePayload {
  return {
    id: item.id,
    title: String(item.title || "Untitled memory"),
    story: String(item.story || ""),
    photo: [],
    attachments: [],
    releaseAt: Number(item.releaseAt || 0) || 0,
  };
}

/** Server commit payload — include portable inline media for Pair cross-device sync. */
export function toServerSealCommitPayload(
  payload: SealDraftFinalizePayload
): SealDraftFinalizePayload {
  const serialize = (rows: unknown[]) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const obj = row && typeof row === "object" ? (row as MediaRow) : {};
        const dataUrl = typeof obj.dataUrl === "string" ? obj.dataUrl.trim() : "";
        const base = {
          id: obj.id,
          name: obj.name,
          mimeType: obj.mimeType,
          size:
            Number(obj.size || 0) ||
            (dataUrl ? Math.ceil((dataUrl.length * 3) / 4) : 0),
        };
        if (!dataUrl) return base;
        return { ...base, dataUrl };
      })
      .filter((row) => {
        const dataUrl = (row as MediaRow).dataUrl;
        return typeof dataUrl === "string" && dataUrl.length > 0;
      });
  return {
    id: payload.id,
    title: payload.title,
    story: payload.story,
    releaseAt: payload.releaseAt,
    photo: serialize(payload.photo),
    attachments: serialize(payload.attachments),
  };
}

export function getSealPayloadByteBudget(forStaging: boolean): number {
  return forStaging ? SEAL_STAGING_MAX_BYTES : SEAL_LOCAL_MAX_BYTES;
}

function hasInlineMediaData(row: unknown): boolean {
  if (!row || typeof row !== "object") return false;
  const dataUrl = (row as MediaRow).dataUrl;
  if (typeof dataUrl === "string" && dataUrl.length > 0) return true;
  const previewUrl = (row as { previewUrl?: string }).previewUrl;
  const blob = (row as { blob?: unknown }).blob;
  if (previewUrl || blob) return true;
  return Number((row as MediaRow).size || 0) > 0;
}

function countMediaWithInlineData(items: unknown[]): number {
  if (!Array.isArray(items)) return 0;
  return items.filter((row) => hasInlineMediaData(row)).length;
}

/**
 * Fail fast before ring prep when media cannot fit the seal handoff budget.
 * Surfaces limit errors instead of silent trimming or generic upload failures.
 */
/** Show the seal size meter only when near/over budget — not for a single small photo. */
export const SEAL_SIZE_METER_MIN_BYTES = 2 * 1024 * 1024;

export type ComposerSealSizeStatus = {
  withinLimit: boolean;
  limitMb: number;
  usedMb: number;
  usedBytes: number;
  wouldTrimMedia: boolean;
  showMeter: boolean;
  /** Device headroom lower than draft size — advisory meter only. */
  headroomLow?: boolean;
  /** True when displayed limit reflects device headroom below 500MB. */
  limitApprox?: boolean;
  /** Draft includes video — stricter total cap applies. */
  hasVideo?: boolean;
  /** Device storage headroom below video-safe threshold. */
  videoHeadroomLow?: boolean;
  /** Recommend / force seal text + cover only. */
  suggestLightVideoSeal?: boolean;
};

function formatUsedMb(usedBytes: number): number {
  return Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
}

function hasHeavyAttachments(attachments: unknown[]): boolean {
  if (!Array.isArray(attachments)) return false;
  return attachments.some((row) => {
    if (!row || typeof row !== "object") return false;
    const mime = String((row as MediaRow).mimeType || "").toLowerCase();
    if (mime.startsWith("video/")) return true;
    const blob = (row as { blob?: Blob }).blob;
    const blobSize = blob instanceof Blob ? blob.size : 0;
    const size = Number((row as MediaRow).size || 0);
    return Math.max(size, blobSize) > 512 * 1024;
  });
}

export function shouldShowComposerSealSizeMeter(
  status: Pick<ComposerSealSizeStatus, "withinLimit" | "wouldTrimMedia" | "usedBytes">,
  attachments: unknown[] = []
): boolean {
  if (!status.withinLimit || status.wouldTrimMedia) return true;
  if (hasHeavyAttachments(attachments)) return true;
  return status.usedBytes >= SEAL_SIZE_METER_MIN_BYTES;
}

function resolveComposerSealDisplayLimitMb(
  est: Awaited<ReturnType<typeof readStorageEstimate>>
): { limitMb: number; limitApprox: boolean } {
  const productMb = Math.floor(SEAL_LOCAL_MAX_BYTES / (1024 * 1024));
  if (!est || est.headroom <= 0) {
    return { limitMb: productMb, limitApprox: false };
  }
  const fromHeadroom = Math.floor((est.headroom * 0.9) / (1024 * 1024));
  if (fromHeadroom > 0 && fromHeadroom < productMb) {
    return { limitMb: Math.max(1, fromHeadroom), limitApprox: true };
  }
  return { limitMb: productMb, limitApprox: false };
}

export async function evaluateComposerSealSize(
  item: {
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  },
  opts: { isPlus?: boolean } = {}
): Promise<ComposerSealSizeStatus> {
  return evaluateLocalComposerSealSize(item, opts);
}

function estimatePhotoBytes(items: unknown[], meterOnly = false): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    total += meterOnly ? meterAttachmentBytes(row) : logicalAttachmentBytes(row);
  }
  return total;
}

function estimateAttachmentBytesSplit(
  items: unknown[],
  meterOnly = false
): {
  videoBytes: number;
  otherBytes: number;
} {
  if (!Array.isArray(items)) return { videoBytes: 0, otherBytes: 0 };
  let videoBytes = 0;
  let otherBytes = 0;
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const bytes = meterOnly ? meterAttachmentBytes(row) : logicalAttachmentBytes(row);
    const mime = String((row as MediaRow).mimeType || "");
    if (isVideoAttachmentRef(row) || isVideoMimeType(mime)) {
      videoBytes += bytes;
    } else {
      otherBytes += bytes;
    }
  }
  return { videoBytes, otherBytes };
}

export async function shouldForceVideoLightSealMode(): Promise<boolean> {
  const est = await readStorageEstimate();
  if (est && est.headroom > 0 && est.headroom < VIDEO_HEADROOM_WARN_BYTES) {
    return true;
  }
  if (isIosWebKit() && estimateOomRisk() !== "low") {
    return true;
  }
  return false;
}

function resolveSealBudgetBytes(hasVideo: boolean, forStaging: boolean, isPlus: boolean): number {
  if (forStaging) return resolveSealStagingPlaintextMaxBytes(isPlus);
  if (hasVideo) return MAX_MEMORY_WITH_VIDEO_BYTES;
  return SEAL_LOCAL_MAX_BYTES;
}

function assertVideoAttachmentLimits(attachments: unknown[]): void {
  if (!Array.isArray(attachments)) return;
  for (const row of attachments) {
    if (!row || typeof row !== "object") continue;
    const mime = String((row as MediaRow).mimeType || "");
    if (!isVideoAttachmentRef(row) && !isVideoMimeType(mime)) continue;
    const size = logicalAttachmentBytes(row);
    if (size > MAX_VIDEO_ATTACHMENT_BYTES) {
      throwSealVideoTooLarge();
    }
  }
}

/**
 * Fast seal-size estimate without re-encoding images (iOS WebKit stability).
 */
export function estimateComposerSealSizeLight(
  item: {
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  },
  opts: { forStaging?: boolean; isPlus?: boolean } = { forStaging: false }
): ComposerSealSizeStatus {
  const isPlus = Boolean(opts.isPlus);
  const forStaging = Boolean(opts.forStaging);
  const hasVideo = draftHasVideoAttachment(item.attachments ?? []);
  const maxBytes = resolveSealBudgetBytes(hasVideo, forStaging, isPlus);
  const limitMb = hasVideo && !forStaging
    ? MAX_MEMORY_WITH_VIDEO_MB
    : Math.floor(maxBytes / (1024 * 1024));

  const baseBytes = estimateJsonBytes({
    id: "composer-estimate",
    title: String(item.title || ""),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
    photo: [],
    attachments: [],
  });
  const photoBytes = estimatePhotoBytes(item.photo ?? [], true);
  const { videoBytes, otherBytes } = estimateAttachmentBytesSplit(
    item.attachments ?? [],
    true
  );
  const logicalPhotoBytes = estimatePhotoBytes(item.photo ?? [], false);
  const logicalSplit = estimateAttachmentBytesSplit(item.attachments ?? [], false);
  const usedBytes = baseBytes + photoBytes + videoBytes + otherBytes;
  const logicalBytes =
    baseBytes + logicalPhotoBytes + logicalSplit.videoBytes + logicalSplit.otherBytes;
  const usedMb = formatUsedMb(usedBytes);

  const status = {
    withinLimit: logicalBytes <= maxBytes,
    limitMb,
    usedMb,
    usedBytes,
    wouldTrimMedia: false,
    hasVideo,
  };
  return {
    ...status,
    showMeter: shouldShowComposerSealSizeMeter(status, item.attachments ?? []),
  };
}

/**
 * Local persist seal meter — 500MB cap for display; headroom is advisory only.
 */
export async function evaluateLocalComposerSealSize(
  item: {
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  },
  opts: { isPlus?: boolean } = {}
): Promise<ComposerSealSizeStatus> {
  const light = estimateComposerSealSizeLight(item, {
    forStaging: false,
    isPlus: Boolean(opts.isPlus),
  });
  const est = await readStorageEstimate();
  const hasVideo = Boolean(light.hasVideo);
  const productCap = hasVideo ? MAX_MEMORY_WITH_VIDEO_BYTES : SEAL_LOCAL_MAX_BYTES;
  const { limitMb, limitApprox } = hasVideo
    ? { limitMb: MAX_MEMORY_WITH_VIDEO_MB, limitApprox: false }
    : resolveComposerSealDisplayLimitMb(est);
  const baseBytes = estimateJsonBytes({
    id: "composer-estimate",
    title: String(item.title || ""),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
    photo: [],
    attachments: [],
  });
  const logicalPhotoBytes = estimatePhotoBytes(item.photo ?? [], false);
  const logicalSplit = estimateAttachmentBytesSplit(item.attachments ?? [], false);
  const logicalBytes =
    baseBytes + logicalPhotoBytes + logicalSplit.videoBytes + logicalSplit.otherBytes;
  const overCap = logicalBytes > productCap;
  const headroomLow =
    est != null && est.headroom > 0 && logicalBytes > est.headroom && !overCap;
  const videoHeadroomLow =
    hasVideo &&
    est != null &&
    est.headroom > 0 &&
    est.headroom < VIDEO_HEADROOM_WARN_BYTES;
  const suggestLightVideoSeal =
    hasVideo &&
    (videoHeadroomLow ||
      (isIosWebKit() && estimateOomRisk() !== "low"));
  const withinLimit = !overCap;
  const status = {
    withinLimit,
    limitMb,
    usedMb: light.usedMb,
    usedBytes: light.usedBytes,
    wouldTrimMedia: false,
    headroomLow,
    limitApprox,
    hasVideo,
    videoHeadroomLow,
    suggestLightVideoSeal,
  };
  return {
    ...status,
    showMeter:
      overCap ||
      headroomLow ||
      videoHeadroomLow ||
      shouldShowComposerSealSizeMeter(status, item.attachments ?? []),
  };
}

export async function assertDraftFitsSealBudget(
  item: {
    id: string;
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  } | null,
  opts: { forStaging?: boolean; isPlus?: boolean } = {}
): Promise<void> {
  if (!item?.id) return;
  await assertDraftFitsLocalPersistBudget(item, Boolean(opts.isPlus));
}

/** Local-first persist — only fail when over 500MB cap or physical headroom. */
export async function assertDraftFitsLocalPersistBudget(
  item: {
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  },
  _isPlus = false
): Promise<void> {
  const status = estimateComposerSealSizeLight(item, { forStaging: false });
  const hasVideo = Boolean(status.hasVideo);
  const capBytes = hasVideo ? MAX_MEMORY_WITH_VIDEO_BYTES : SEAL_LOCAL_MAX_BYTES;
  const logicalPhotoBytes = estimatePhotoBytes(item.photo ?? [], false);
  const logicalSplit = estimateAttachmentBytesSplit(item.attachments ?? [], false);
  const baseBytes = estimateJsonBytes({
    id: "cap-check",
    title: String(item.title || ""),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
    photo: [],
    attachments: [],
  });
  const logicalBytes =
    baseBytes + logicalPhotoBytes + logicalSplit.videoBytes + logicalSplit.otherBytes;

  if (hasVideo) {
    assertVideoAttachmentLimits(item.attachments ?? []);
    const est = await readStorageEstimate();
    if (est && est.headroom > 0 && est.headroom < VIDEO_HEADROOM_WARN_BYTES) {
      if (typeof console !== "undefined") {
        console.warn("[haven-ring] video headroom low", {
          headroomMb: Math.round(est.headroom / (1024 * 1024)),
          warnMb: VIDEO_HEADROOM_WARN_MB,
        });
      }
    }
  }

  if (logicalBytes > capBytes) {
    if (hasVideo) {
      throwSealVideoTooLarge();
    }
    if (typeof console !== "undefined") {
      console.warn("[haven-ring] seal local budget exceeded", {
        usedMb: status.usedMb,
        capMb: Math.floor(capBytes / (1024 * 1024)),
      });
    }
    throwSealLocalStorageFull();
  }
  const est = await readStorageEstimate();
  if (est && status.usedBytes > est.headroom) {
    if (typeof console !== "undefined") {
      console.warn("[haven-ring] seal headroom low (advisory only)", {
        usedMb: status.usedMb,
        headroomMb: Math.round(est.headroom / (1024 * 1024)),
        usageRatio: est.usageRatio,
      });
    }
  }
}

export { estimateJsonBytes };
