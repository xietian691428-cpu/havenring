/**
 * Seal finalize entry — local-first persist + ring-tap chain (critical path stays on main thread).
 */

export {
  finalizeSealChainFromSdmResponseSafe,
  clearSealFlowAndReturnToApp,
  goToSealSuccess,
  type FinalizeSealResult,
} from "./sealFinalizeSafe";

export {
  primeSealPrepAfterDraftPersisted,
  prepareSealForRingTap,
  collectDraftPayloadsForSeal,
  sealPayloadFromDraftItem,
  persistSealedDraftsLocallyFirst,
  getSealSdmContextPayload,
  syncHydrateSealPrepFromStorage,
  abandonInProgressSealOnStartPage,
  finalizeSealChainFromSdmResponse,
  SEAL_STEP_UP_REQUIRED,
} from "./sealFlowClient";

export { persistSealLocalRelay } from "./sealLocalRelay";
