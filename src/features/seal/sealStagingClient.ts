import {
  SEAL_STAGING_MAX_CIPHERTEXT_BYTES,
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
  error?: string;
  error_code?: string;
};

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

export function assertSealPayloadWithinQuota(payloads: SealDraftFinalizePayload[]): void {
  const bytes = estimateSealPayloadBytes(payloads);
  if (bytes > SEAL_STAGING_MAX_CIPHERTEXT_BYTES) {
    throw new Error(SEAL_STAGING_TOO_LARGE);
  }
}

export async function uploadSealStaging(opts: {
  draftIds: string[];
  payloads: SealDraftFinalizePayload[];
  accessToken: string;
}): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(SEAL_STAGING_OFFLINE);
  }
  const { draftIds, payloads, accessToken } = opts;
  assertSealPayloadWithinQuota(payloads);
  const plaintext = JSON.stringify({ payloads });
  const { ciphertext, iv } = await encryptSealStagingJson(plaintext, accessToken);
  if (ciphertext.length > SEAL_STAGING_MAX_CIPHERTEXT_BYTES) {
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
  if (!res.ok || !json.ciphertext || !json.iv) {
    throw new Error(
      typeof json.error === "string" && json.error.trim()
        ? json.error.trim()
        : "Your memory could not be loaded — tap Seal with Ring and try again."
    );
  }
  const draftIds = parseSealStagingDraftIds(json.draft_ids);
  if (expectedDraftIds.length && draftIds.length) {
    const a = [...expectedDraftIds].sort().join(",");
    const b = [...draftIds].sort().join(",");
    if (a !== b) {
      throw new Error("Your memory could not be loaded — tap Seal with Ring and try again.");
    }
  }
  const plaintext = await decryptSealStagingJson(json.ciphertext, json.iv, accessToken);
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
