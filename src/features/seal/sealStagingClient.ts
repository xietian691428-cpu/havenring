import {
  SEAL_STAGING_CHUNK_BYTES,
  SEAL_STAGING_INLINE_POST_MAX_BYTES,
  resolveSealStagingMaxBytes,
  resolveSealStagingPlaintextMaxBytes,
  parseSealStagingDraftIds,
} from "@/lib/seal-staging-shared";
import {
  runStagingChunkedUpload,
  runStagingDeleteInBackground,
  runStagingInlineUpload,
} from "@/lib/background-sync-client";
import { binarySizeFromBase64 } from "@/lib/seal-staging-upload-net";
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

async function uploadSealStagingInline(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  isPlus: boolean;
}): Promise<string> {
  return runStagingInlineUpload({
    draftIds: opts.draftIds,
    ciphertext: opts.ciphertext,
    iv: opts.iv,
    accessToken: opts.accessToken,
    isPlus: opts.isPlus,
  });
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
  return runStagingChunkedUpload({
    draftIds: opts.draftIds,
    ciphertext: opts.ciphertext,
    iv: opts.iv,
    accessToken: opts.accessToken,
    chunkChars: SEAL_STAGING_CHUNK_BYTES,
    uploadId,
    isPlus: opts.isPlus,
  });
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
  await runStagingDeleteInBackground(stagingId, accessToken);
}

export async function deleteArmedSealStaging(accessToken: string): Promise<void> {
  const stagingId = getArmedSealStagingId();
  if (!stagingId) return;
  await deleteSealStaging(stagingId, accessToken);
}
