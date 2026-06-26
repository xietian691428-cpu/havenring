/**
 * Network-only seal staging upload/delete. Safe for Dedicated Worker or main-thread fallback.
 */

export type StagingCreateApiBody = {
  staging_id?: string;
  expires_at?: string;
  error?: string;
  error_code?: string;
};

export type StagingUploadNetResult =
  | { ok: true; stagingId: string }
  | { ok: false; step: string; status: number; body: StagingCreateApiBody };

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export function binarySizeFromBase64(ciphertextB64: string): number {
  const trimmed = ciphertextB64.trim();
  if (!trimmed) return 0;
  const padding = trimmed.endsWith("==") ? 2 : trimmed.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((trimmed.length * 3) / 4) - padding);
}

export function splitBase64Ciphertext(ciphertextB64: string, chunkChars: number): string[] {
  const aligned = Math.max(4, Math.floor(chunkChars / 4) * 4);
  const chunks: string[] = [];
  for (let i = 0; i < ciphertextB64.length; i += aligned) {
    chunks.push(ciphertextB64.slice(i, i + aligned));
  }
  return chunks;
}

export async function uploadStagingInlineNet(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
}): Promise<StagingUploadNetResult> {
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
  const body = (await res.json().catch(() => ({}))) as StagingCreateApiBody;
  if (!res.ok || !body.staging_id) {
    return { ok: false, step: "staging_inline", status: res.status, body };
  }
  return { ok: true, stagingId: String(body.staging_id) };
}

export async function uploadStagingChunkedNet(opts: {
  draftIds: string[];
  ciphertext: string;
  iv: string;
  accessToken: string;
  chunkChars: number;
  uploadId: string;
}): Promise<StagingUploadNetResult> {
  const chunks = splitBase64Ciphertext(opts.ciphertext, opts.chunkChars);
  for (let index = 0; index < chunks.length; index += 1) {
    const res = await fetch("/api/seal/staging", {
      method: "POST",
      headers: authHeaders(opts.accessToken),
      body: JSON.stringify({
        mode: "chunk",
        upload_id: opts.uploadId,
        chunk_index: index,
        total_chunks: chunks.length,
        data_b64: chunks[index],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as StagingCreateApiBody;
    if (!res.ok || body.error) {
      return { ok: false, step: `staging_chunk_${index}`, status: res.status, body };
    }
  }
  const commitRes = await fetch("/api/seal/staging", {
    method: "POST",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify({
      mode: "commit",
      upload_id: opts.uploadId,
      draft_ids: opts.draftIds,
      iv: opts.iv,
      total_chunks: chunks.length,
      byte_size: binarySizeFromBase64(opts.ciphertext),
    }),
  });
  const commitBody = (await commitRes.json().catch(() => ({}))) as StagingCreateApiBody;
  if (!commitRes.ok || !commitBody.staging_id) {
    return {
      ok: false,
      step: "staging_commit",
      status: commitRes.status,
      body: commitBody,
    };
  }
  return { ok: true, stagingId: String(commitBody.staging_id) };
}

export async function deleteStagingNet(
  stagingId: string,
  accessToken: string
): Promise<void> {
  const id = String(stagingId || "").trim();
  if (!id || !accessToken) return;
  await fetch(`/api/seal/staging/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  }).catch(() => null);
}
