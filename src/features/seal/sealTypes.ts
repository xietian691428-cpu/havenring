import type { UserEntitlements } from "../subscription/subscriptionTypes";

/**
 * Client Seal constants — MUST stay aligned with `lib/seal-shared.ts` draft limits where applicable.
 */
export const MAX_SEAL_DRAFT_IDS = 20;

export const PENDING_SEAL_DRAFT_IDS_KEY = "haven.pending_seal_draft_ids.v1";

/** `context` passed to `POST /api/rings/sdm/resolve` for Seal with Ring completion. */
export const SEAL_SDM_CONTEXT = "seal_confirmation" as const;

export const SEAL_SUCCESS_PATH = "/seal-success";

/** Plain ticket + finalize payloads (IDB draft → RPC). */
export type SealDraftFinalizePayload = {
  id: string;
  title: string;
  story: string;
  photo: unknown[];
  attachments: unknown[];
  releaseAt: number;
};

export type SealSdmContextPayload = {
  context: typeof SEAL_SDM_CONTEXT | "";
  draft_ids: string[];
};

export type FinalizeSealWithTicketOptions = {
  sealTicket: string;
  draftIds: string[];
  accessToken: string;
};

/** When `views/NewMemoryPage` moves to TSX, consume this prop shape + defaults. */
export type NewMemorySealComposerProps = {
  userEntitlements: UserEntitlements;
};
