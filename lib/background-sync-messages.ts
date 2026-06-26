import type { SealFinalizeApiBody, SealFinalizeNetResult } from "@/lib/seal-server-finalize-net";
import type { StagingCreateApiBody, StagingUploadNetResult } from "@/lib/seal-staging-upload-net";

export type BackgroundSyncRequest =
  | {
      id: string;
      kind: "seal_finalize";
      sealTicket: string;
      draftIds: string[];
      accessToken: string;
      serverPayloads: unknown[];
    }
  | {
      id: string;
      kind: "staging_inline";
      draftIds: string[];
      ciphertext: string;
      iv: string;
      accessToken: string;
    }
  | {
      id: string;
      kind: "staging_chunked";
      draftIds: string[];
      ciphertext: string;
      iv: string;
      accessToken: string;
      chunkChars: number;
      uploadId: string;
    }
  | {
      id: string;
      kind: "staging_delete";
      stagingId: string;
      accessToken: string;
    };

export type BackgroundSyncResponse =
  | { id: string; ok: true; stagingId?: string }
  | {
      id: string;
      ok: false;
      kind: BackgroundSyncRequest["kind"];
      sealResult?: SealFinalizeNetResult;
      stagingResult?: StagingUploadNetResult;
      message?: string;
    };

export type { SealFinalizeApiBody, StagingCreateApiBody };
