/**
 * Network-only seal finalize (precheck + commit). Safe for Dedicated Worker or main-thread fallback.
 */

export type SealFinalizeApiBody = {
  ok?: unknown;
  error?: unknown;
  error_code?: unknown;
};

export type SealFinalizeNetResult =
  | { ok: true }
  | { ok: false; step: "precheck" | "commit"; status: number; body: SealFinalizeApiBody };

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function sealFinalizePrecheckNet(opts: {
  sealTicket: string;
  draftIds: string[];
  accessToken: string;
}): Promise<SealFinalizeNetResult> {
  const res = await fetch("/api/seal/finalize", {
    method: "POST",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify({
      seal_ticket: opts.sealTicket,
      draft_ids: opts.draftIds,
      mode: "precheck",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as SealFinalizeApiBody;
  if (!res.ok || body?.ok !== true) {
    return { ok: false, step: "precheck", status: res.status, body };
  }
  return { ok: true };
}

export async function sealFinalizeCommitNet(opts: {
  sealTicket: string;
  draftIds: string[];
  accessToken: string;
  serverPayloads: unknown[];
}): Promise<SealFinalizeNetResult> {
  const res = await fetch("/api/seal/finalize", {
    method: "POST",
    headers: authHeaders(opts.accessToken),
    body: JSON.stringify({
      seal_ticket: opts.sealTicket,
      draft_ids: opts.draftIds,
      mode: "commit",
      draft_payloads: opts.serverPayloads,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as SealFinalizeApiBody;
  if (!res.ok || body?.ok !== true) {
    return { ok: false, step: "commit", status: res.status, body };
  }
  return { ok: true };
}

export async function sealFinalizeNetworkRoundTrip(opts: {
  sealTicket: string;
  draftIds: string[];
  accessToken: string;
  serverPayloads: unknown[];
}): Promise<SealFinalizeNetResult> {
  const pre = await sealFinalizePrecheckNet(opts);
  if (!pre.ok) return pre;
  return sealFinalizeCommitNet(opts);
}
