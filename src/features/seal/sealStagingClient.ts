import {
  SEAL_STAGING_MAX_BYTES,
  SEAL_STAGING_MAX_CIPHERTEXT_BYTES,
  resolveSealStagingMaxBytes,
  parseSealStagingDraftIds,
} from "@/lib/seal-staging-shared";
import type { SealDraftFinalizePayload } from "./sealTypes";
import {
  decryptSealStagingJson,
  encryptSealStagingJson,
} from "./sealStagingCrypto";
import { getArmedSealStagingId } from "@/lib/seal-flow";
import { SEAL_STAGING_TOO_LARGE, SEAL_STAGING_OFFLINE } from "./sealUserMessages";

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
  maxBytes: number = SEAL_STAGING_MAX_CIPHERTEXT_BYTES
): void {
  const bytes = estimateSealPayloadBytes(payloads);
  if (bytes > maxBytes) {
    throw new Error(SEAL_STAGING_TOO_LARGE);
  }
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
  const maxBytes = resolveSealStagingMaxBytes(Boolean(opts.isPlus));
  assertSealPayloadWithinQuota(payloads, maxBytes);
  const plaintext = JSON.stringify({ payloads });
  const { ciphertext, iv } = await encryptSealStagingJson(plaintext, accessToken);
  if (ciphertext.length > maxBytes) {
    throw new Error(SEAL_STAGING_TOO_LARGE);
  }
  const res = await fetch("/api/seal/staging", {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      draft_ids: draftIds,
      ciphertext,
      iv,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as StagingCreateResponse;
  if (!res.ok || !json.staging_id) {
    if (json.error_code === "STAGING_DISABLED" || res.status === 503) {
      throw new Error("Sealing is briefly unavailable — try again in a moment.");
    }
    throw new Error(
      typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Could not prepare your memory for sealing."
    );
  }
  return String(json.staging_id);
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
