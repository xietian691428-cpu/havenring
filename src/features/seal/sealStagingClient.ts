import {
  SEAL_STAGING_CHUNK_BYTES,
  SEAL_STAGING_INLINE_POST_MAX_BYTES,
  resolveSealStagingMaxBytes,
  resolveSealStagingPlaintextMaxBytes,
  parseSealStagingDraftIds,
} from "@/lib/seal-staging-shared";
import type { SealDraftFinalizePayload } from "./sealTypes";
import {
  decryptSealStagingJson,
  encryptSealStagingJson,
} from "./sealStagingCrypto";
import { getArmedSealStagingId } from "@/lib/seal-flow";
import {
  SEAL_STAGING_OFFLINE,
  SEAL_STAGING_TOO_LARGE,
  isSealStagingTooLargeError,
  throwSealStagingTooLarge,
} from "./sealUserMessages";

type StagingCreateResponse = {
  staging_id?: string;
  expires_at?: string;
  error?: string;
  error_code?: string;
};

type StagingFetchResponse = {
  ciphertext?: string;
  iv?: string;
  draft_ids?: unknown;
  delivery?: "inline" | "signed_url";
  signed_url?: string;
  error?: string;
  error_code?: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function binarySizeFromBase64(ciphertextB64: string): number {
  const trimmed = ciphertextB64.trim();
  if (!trimmed) return 0;
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

function splitBase64Ciphertext(ciphertextB64: string, chunkChars: number): string[] {
  const aligned = Math.max(4, Math.floor(chunkChars / 4) * 4);
  const chunks: string[] = [];
  for (let i = 0; i < ciphertextB64.length; i += aligned) {
    chunks.push(ciphertextB64.slice(i, i + aligned));
  }
  return chunks;
}

async function resolveStagingCiphertext(
  json: StagingFetchResponse
): Promise<{ ciphertext: string; iv: string }> {
  const iv = typeof json.iv === "string" ? json.iv.trim() : "";
  if (!iv) {
    throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
  }
  if (json.delivery === "signed_url" && typeof json.signed_url === "string") {
    const blobRes = await fetch(json.signed_url);
    if (!blobRes.ok) {
      throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
    }
    const buf = new Uint8Array(await blobRes.arrayBuffer());
    return { ciphertext: bytesToBase64(buf), iv };
  }
  const ciphertext = typeof json.ciphertext === "string" ? json.ciphertext.trim() : "";
  if (!ciphertext) {
    throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
  }
  return { ciphertext, iv };
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export function estimateSealPayloadBytes(payloads: SealDraftFinalizePayload[]): number {
  try {
    return new Blob([JSON.stringify({ payloads })]).size;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function assertSealPayloadWithinQuota(
  payloads: SealDraftFinalizePayload[],
  maxBytes: number,
  isPlus = false
): void {
  const bytes = estimateSealPayloadBytes(payloads);
  if (bytes > maxBytes) {
    throwSealStagingTooLarge(isPlus, true);
  }
}

function parseStagingCreateError(
  json: StagingCreateResponse,
  res: Response
): string {
  if (json.error_code === "STAGING_DISABLED" || res.status === 503) {
    return "Sealing is briefly unavailable — try again in a moment.";
  }
  if (json.error_code === "STAGING_TOO_LARGE" || res.status === 413) {
    return SEAL_STAGING_TOO_LARGE;
  }
  return typeof json.error === "string" && json.error.trim()
    ? json.error.trim()
    : "Could not prepare your memory for sealing.";
}

function throwStagingCreateError(
  json: StagingCreateResponse,
  res: Response,
  isPlus: boolean
): never {
  if (json.error_code === "STAGING_TOO_LARGE" || res.status === 413) {
    throwSealStagingTooLarge(isPlus, true);
  }
  throw new Error(parseStagingCreateError(json, res));
}

async function uploadSealStagingInline(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  isPlus: boolean;
}): Promise<string> {
  const res = await fetch("/api/seal/staging", {
    method: "POST",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify({
      mode: "create",
      draft_ids: opts.draftIds,
      ciphertext: opts.ciphertext,
      iv: opts.iv,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as StagingCreateResponse;
  if (!res.ok || !json.staging_id) {
    throwStagingCreateError(json, res, opts.isPlus);
  }
  return String(json.staging_id);
}

async function uploadSealStagingChunked(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  isPlus: boolean;
}): Promise<string> {
  const uploadId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `staging-${Date.now()}`;
  const chunks = splitBase64Ciphertext(opts.ciphertext, SEAL_STAGING_CHUNK_BYTES);
  for (let index = 0; index < chunks.length; index += 1) {
    const res = await fetch("/api/seal/staging", {
      method: "POST",
      headers: authHeaders(opts.accessToken),
      body: JSON.stringify({
        mode: "chunk",
        upload_id: uploadId,
        chunk_index: index,
        total_chunks: chunks.length,
        data_b64: chunks[index],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as StagingCreateResponse;
    if (!res.ok || json.error) {
      throwStagingCreateError(json, res, opts.isPlus);
    }
  }
  const commitRes = await fetch("/api/seal/staging", {
    method: "POST",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify({
      mode: "commit",
      upload_id: uploadId,
      draft_ids: opts.draftIds,
      iv: opts.iv,
      total_chunks: chunks.length,
      byte_size: binarySizeFromBase64(opts.ciphertext),
    }),
  });
  const commitJson = (await commitRes.json().catch(() => ({}))) as StagingCreateResponse;
  if (!commitRes.ok || !commitJson.staging_id) {
    throwStagingCreateError(commitJson, commitRes, opts.isPlus);
  }
  return String(commitJson.staging_id);
}

export async function uploadSealStaging(opts: {
  draftIds: string[];
  payloads: SealDraftFinalizePayload[];
  accessToken: string;
  isPlus?: boolean;
}): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(SEAL_STAGING_OFFLINE);
  }
  const { draftIds, payloads, accessToken } = opts;
  const isPlus = Boolean(opts.isPlus);
  const plaintextMax = resolveSealStagingPlaintextMaxBytes(isPlus);
  const ciphertextMax = resolveSealStagingMaxBytes(isPlus);
  assertSealPayloadWithinQuota(payloads, plaintextMax, isPlus);
  const plaintext = JSON.stringify({ payloads });
  const { ciphertext, iv } = await encryptSealStagingJson(plaintext, accessToken);
  const cipherBytes = binarySizeFromBase64(ciphertext);
  if (cipherBytes > ciphertextMax) {
    throwSealStagingTooLarge(isPlus, true);
  }
  if (cipherBytes <= SEAL_STAGING_INLINE_POST_MAX_BYTES) {
    return uploadSealStagingInline({
      draftIds,
      ciphertext,
      iv,
      accessToken,
      isPlus,
    });
  }
  return uploadSealStagingChunked({
    draftIds,
    ciphertext,
    iv,
    accessToken,
    isPlus,
  });
}

/** Best-effort staging — never blocks local-first seal when payload is too large. */
export async function tryUploadSealStaging(opts: {
  draftIds: string[];
  payloads: SealDraftFinalizePayload[];
  accessToken: string;
  isPlus?: boolean;
}): Promise<string | undefined> {
  try {
    return await uploadSealStaging(opts);
  } catch (error) {
    if (isSealStagingTooLargeError(error)) {
      console.warn(
        "[haven-ring] seal staging skipped (too large); local relay is authoritative"
      );
      return undefined;
    }
    if (error instanceof Error && error.message === SEAL_STAGING_OFFLINE) {
      return undefined;
    }
    throw error;
  }
}

export async function fetchSealStagingPayloads(opts: {
  stagingId: string;
  accessToken: string;
  expectedDraftIds?: string[];
}): Promise<SealDraftFinalizePayload[]> {
  const { stagingId, accessToken, expectedDraftIds = [] } = opts;
  const res = await fetch(`/api/seal/staging/${encodeURIComponent(stagingId)}`, {
    method: "GET",
    headers: authHeaders(accessToken),
  });
  const json = (await res.json().catch(() => ({}))) as StagingFetchResponse;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Your memory could not be loaded — tap Seal with Ring and try again."
    );
  }
  const { ciphertext, iv } = await resolveStagingCiphertext(json);
  const draftIds = parseSealStagingDraftIds(json.draft_ids);
  if (expectedDraftIds.length && draftIds.length) {
    const a = [...expectedDraftIds].sort().join(",");
    const b = [...draftIds].sort().join(",");
    if (a !== b) {
      throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
    }
  }
  const plaintext = await decryptSealStagingJson(ciphertext, iv, accessToken);
  const parsed = JSON.parse(plaintext) as { payloads?: SealDraftFinalizePayload[] };
  if (!Array.isArray(parsed.payloads) || !parsed.payloads.length) {
    throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
  }
  return parsed.payloads;
}

export async function deleteSealStaging(
  stagingId: string,
  accessToken: string
): Promise<void> {
  const id = String(stagingId || "").trim();
  if (!id || !accessToken) return;
  try {
    await fetch(`/api/seal/staging/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(accessToken),
    });
  } catch {
    /* best effort */
  }
}

export async function deleteArmedSealStaging(accessToken: string): Promise<void> {
  const stagingId = getArmedSealStagingId();
  if (!stagingId) return;
  await deleteSealStaging(stagingId, accessToken);
}
