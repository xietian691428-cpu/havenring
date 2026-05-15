export type {
  FinalizeSealWithTicketOptions,
  NewMemorySealComposerProps,
  SealDraftFinalizePayload,
  SealSdmContextPayload,
} from "./sealTypes";
export type { NewMemoryPageSealPropShape } from "./NewMemoryPage";
export {
  MAX_SEAL_DRAFT_IDS,
  PENDING_SEAL_DRAFT_IDS_KEY,
  SEAL_SDM_CONTEXT,
  SEAL_SUCCESS_PATH,
} from "./sealTypes";

export {
  FEATURE_SEAL_WITH_RING,
  canSealWithRing,
  gateSealWithRingAccess,
  type SealWithRingGateResult,
} from "./sealEntitlementGate";

export {
  armSealFlow,
  clearSealFlowArm,
  isSealFlowArmed,
  getSealArmedRemainingMs,
  readPendingSealDraftIds,
  writePendingSealDraftIds,
  clearPendingSealDraftIds,
  clearSealPrepState,
  primeSealPrepAfterDraftPersisted,
  collectDraftPayloadsForSeal,
  finalizeSealWithTicket,
  getSealSdmContextPayload,
  syncSealPrepWithSessionArm,
  abandonInProgressSealOnStartPage,
  finalizeSealChainFromSdmResponse,
} from "./sealFlowClient";
