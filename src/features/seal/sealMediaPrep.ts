import { resolveComposerMediaRowForSeal } from "@/lib/composer-photo-utils";
import {
  SEAL_LOCAL_MAX_BYTES,
  SEAL_STAGING_MAX_BYTES,
  resolveSealStagingPlaintextMaxBytes,
} from "@/lib/seal-staging-shared";
import {
  throwSealLocalStorageFull,
  throwSealStagingTooLarge,
} from "./sealUserMessages";
import type { SealDraftFinalizePayload } from "./sealTypes";
import {
  readStorageEstimate,
  SEAL_LOCAL_PERSIST_DEFAULT_BYTES,
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

export async function evaluateComposerSealSize(
  item: {
    title?: string;
    story?: string;
    photo?: unknown[];
    attachments?: unknown[];
    releaseAt?: number;
  },
  opts: { forStaging: boolean; isPlus?: boolean } = { forStaging: true }
): Promise<ComposerSealSizeStatus> {
  const isPlus = Boolean(opts.isPlus);
  const forStaging = Boolean(opts.forStaging);
  const maxBytes = forStaging
    ? resolveSealStagingPlaintextMaxBytes(isPlus)
    : SEAL_LOCAL_MAX_BYTES;
  const limitMb = Math.floor(maxBytes / (1024 * 1024));

  const draft = {
    id: "composer-estimate",
    title: String(item.title || ""),
    story: String(item.story || ""),
    photo: Array.isArray(item.photo) ? item.photo : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    releaseAt: Number(item.releaseAt || 0) || 0,
  };

  const payload = await buildSealPayloadFromDraft(draft, { maxBytes });
  const usedBytes = payload ? estimateJsonBytes(payload) : 0;
  const usedMb = formatUsedMb(usedBytes);

  const origPhotoCount = countMediaWithInlineData(draft.photo);
  const origAttachCount = countMediaWithInlineData(draft.attachments);
  const stagedPhotoCount = countMediaWithInlineData(payload?.photo ?? []);
  const stagedAttachCount = countMediaWithInlineData(payload?.attachments ?? []);
  const wouldTrimMedia =
    origPhotoCount > stagedPhotoCount || origAttachCount > stagedAttachCount;
  const overBudget = usedBytes > maxBytes;

  const status = {
    withinLimit: !wouldTrimMedia && !overBudget,
    limitMb,
    usedMb,
    usedBytes,
    wouldTrimMedia,
  };
  return {
    ...status,
    showMeter: shouldShowComposerSealSizeMeter(status, draft.attachments),
  };
}

function estimateInlineMediaBytes(items: unknown[]): number {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const dataUrl = (row as MediaRow).dataUrl;
    if (typeof dataUrl === "string" && dataUrl.length > 0) {
      total += Math.ceil((dataUrl.length * 3) / 4);
      continue;
    }
    const blob = (row as { blob?: Blob }).blob;
    if (blob instanceof Blob && blob.size > 0) {
      total += blob.size;
      continue;
    }
    const size = Number((row as MediaRow).size || 0);
    if (size > 0) total += size;
  }
  return total;
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
  opts: { forStaging: boolean; isPlus?: boolean } = { forStaging: true }
): ComposerSealSizeStatus {
  const isPlus = Boolean(opts.isPlus);
  const forStaging = Boolean(opts.forStaging);
  const maxBytes = forStaging
    ? resolveSealStagingPlaintextMaxBytes(isPlus)
    : SEAL_LOCAL_MAX_BYTES;
  const limitMb = Math.floor(maxBytes / (1024 * 1024));

  const baseBytes = estimateJsonBytes({
    id: "composer-estimate",
    title: String(item.title || ""),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
    photo: [],
    attachments: [],
  });
  const mediaBytes =
    estimateInlineMediaBytes(item.photo ?? []) +
    estimateInlineMediaBytes(item.attachments ?? []);
  const usedBytes = baseBytes + mediaBytes;
  const usedMb = formatUsedMb(usedBytes);

  const status = {
    withinLimit: usedBytes <= maxBytes,
    limitMb,
    usedMb,
    usedBytes,
    wouldTrimMedia: false,
  };
  return {
    ...status,
    showMeter: shouldShowComposerSealSizeMeter(status, item.attachments ?? []),
  };
}

/**
 * Local persist seal meter — respects device headroom, never staging caps.
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
  const headroomBytes = est?.headroom ?? SEAL_LOCAL_PERSIST_DEFAULT_BYTES;
  const effectiveLimitBytes = Math.min(SEAL_LOCAL_MAX_BYTES, headroomBytes);
  const limitMb = Math.max(1, Math.floor(effectiveLimitBytes / (1024 * 1024)));
  const withinLimit =
    light.usedBytes <= SEAL_LOCAL_MAX_BYTES && light.usedBytes <= effectiveLimitBytes;
  const status = {
    withinLimit,
    limitMb,
    usedMb: light.usedMb,
    usedBytes: light.usedBytes,
    wouldTrimMedia: false,
  };
  return {
    ...status,
    showMeter: shouldShowComposerSealSizeMeter(status, item.attachments ?? []),
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
  opts: { forStaging: boolean; isPlus?: boolean } = { forStaging: true }
): Promise<void> {
  if (!item?.id) return;
  const isPlus = Boolean(opts.isPlus);
  const forStaging = Boolean(opts.forStaging);

  if (!forStaging) {
    await assertDraftFitsLocalPersistBudget(item, isPlus);
    return;
  }

  const maxBytes = resolveSealStagingPlaintextMaxBytes(isPlus);

  const payload = await buildSealPayloadFromDraft(item, { maxBytes });
  if (!payload) return;

  const origPhotoCount = countMediaWithInlineData(
    Array.isArray(item.photo) ? item.photo : []
  );
  const origAttachCount = countMediaWithInlineData(
    Array.isArray(item.attachments) ? item.attachments : []
  );
  const stagedPhotoCount = countMediaWithInlineData(payload.photo);
  const stagedAttachCount = countMediaWithInlineData(payload.attachments);
  const trimmed =
    origPhotoCount > stagedPhotoCount || origAttachCount > stagedAttachCount;
  const overBudget = estimateJsonBytes(payload) > maxBytes;

  if (trimmed || overBudget) {
    throwSealStagingTooLarge(isPlus, forStaging);
  }
}

/** Local-first persist — only fail when over 300MB cap or physical headroom. */
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
  if (status.usedBytes > SEAL_LOCAL_MAX_BYTES) {
    if (typeof console !== "undefined") {
      console.warn("[haven-ring] seal local budget exceeded", {
        usedMb: status.usedMb,
        capMb: Math.floor(SEAL_LOCAL_MAX_BYTES / (1024 * 1024)),
      });
    }
    throwSealLocalStorageFull();
  }
  const est = await readStorageEstimate();
  if (est && status.usedBytes > est.headroom) {
    if (typeof console !== "undefined") {
      console.warn("[haven-ring] seal blocked — not enough device headroom", {
        usedMb: status.usedMb,
        headroomMb: Math.round(est.headroom / (1024 * 1024)),
        usageRatio: est.usageRatio,
      });
    }
    throwSealLocalStorageFull();
  }
}

export { estimateJsonBytes };
