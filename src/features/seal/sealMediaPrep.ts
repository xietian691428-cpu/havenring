import { SEAL_LOCAL_MAX_BYTES, SEAL_STAGING_MAX_BYTES } from "@/lib/seal-staging-shared";
import type { SealDraftFinalizePayload } from "./sealTypes";

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
  let working = items
    .filter((row) => row && typeof row === "object")
    .map((row) => ({ ...(row as MediaRow) }));

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
  opts: { maxBytes?: number; forServerCommit?: boolean } = {}
): Promise<SealDraftFinalizePayload | null> {
  if (!item?.id) return null;
  const maxBytes = opts.maxBytes ?? SEAL_LOCAL_MAX_BYTES;
  const base = {
    id: item.id,
    title: String(item.title || "Untitled memory"),
    story: String(item.story || ""),
    releaseAt: Number(item.releaseAt || 0) || 0,
  };
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

/** Strip inline media for server commit — full blobs stay in local IDB. */
export function toServerSealCommitPayload(
  payload: SealDraftFinalizePayload
): SealDraftFinalizePayload {
  const strip = (rows: unknown[]) =>
    (Array.isArray(rows) ? rows : []).map((row) => {
      const obj = row && typeof row === "object" ? (row as MediaRow) : {};
      return {
        id: obj.id,
        name: obj.name,
        mimeType: obj.mimeType,
        size: obj.size,
      };
    });
  return {
    id: payload.id,
    title: payload.title,
    story: payload.story,
    releaseAt: payload.releaseAt,
    photo: strip(payload.photo),
    attachments: strip(payload.attachments),
  };
}

export function getSealPayloadByteBudget(forStaging: boolean): number {
  return forStaging ? SEAL_STAGING_MAX_BYTES : SEAL_LOCAL_MAX_BYTES;
}

export { estimateJsonBytes };
