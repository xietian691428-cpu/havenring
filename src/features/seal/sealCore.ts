/**
 * Seal core — arm state, navigate, cross-tab, NFC relay, types (no media prep / staging).
 */

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
  armSealFlow,
  armSealFlowWithPersistence,
  clearSealFlowArm,
  getArmedSealDraftIds,
  getArmedSealStagingId,
  isSealFlowArmed,
  getSealArmedRemainingMs,
  clearSealFlowArmIfExpired,
  readActiveSealArmedPayload,
} from "@/lib/seal-flow";

export {
  readPendingSealDraftIds,
  writePendingSealDraftIds,
  clearPendingSealDraftIds,
  clearSealPrepState,
  clearSealPrepStateLocal,
  syncSealPrepWithSessionArm,
  hasPendingSealDrafts,
  shouldMountSealSessionListeners,
} from "./sealPrepState";

export {
  FEATURE_SEAL_WITH_RING,
  canSealWithRing,
  gateSealWithRingAccess,
  type SealWithRingGateResult,
} from "./sealEntitlementGate";

export {
  hasLocalSealPrep,
  isAuxiliarySealTapTab,
  isPrimarySealWaitPage,
  isRingTapSealLandingPage,
  isSealWaitSearch,
  navigateToSealWaitPage,
  sealRelayNavigateHref,
  shouldDeferSdmResolveToOwnerTab,
  SEAL_WAIT_QUERY,
} from "./sealNavigate";

export {
  broadcastSealComplete,
  clearSealCompleteRelay,
  clearSealWaitTabActive,
  isSealWaitTabActive,
  markSealWaitTabActive,
  clearStaleSealResolveLock,
  forceClearSealResolveLock,
  releaseSealResolveLock,
  SEAL_COMPLETE_STORAGE_KEY,
  tryAcquireSealResolveLock,
  tryAcquireSealResolveLockForSealTap,
  wasSealRecentlyCompleted,
} from "./sealCrossTab";

export {
  clearSealNfcTapHref,
  consumeFreshSealNfcTapHref,
  SEAL_NFC_TAP_STORAGE_KEY,
  recordSealNfcTapHref,
  readFreshSealNfcTapHref,
} from "./sealNfcTapRelay";

export {
  clearSealDraftRelay,
  readSealDraftRelay,
  writeSealDraftRelay,
} from "./sealDraftRelay";

export {
  hasSdmInUrlSearch,
  isStaticStartRingUrl,
  normalizeRingTapToStartHref,
} from "./parseRingTapUrl";

export { listenForSealRingTapOnce } from "./sealRingNfcListen";

export {
  abandonSealPrepOnSessionBoundary,
  bindSealSessionBoundaryListeners,
} from "./sealSessionBoundary";

export {
  postSealBroadcast,
  subscribeSealBroadcast,
  closeSealBroadcastChannel,
  type SealBroadcastMessage,
} from "./sealBroadcast";

export {
  getSealStrategy,
  resolveSealTransportMode,
  shouldPreferSameTabWebNfc,
  type SealStrategy,
  type SealTransportMode,
} from "./sealPlatform";

export { isEphemeralStorageEnvironment } from "./ephemeralStorage";

export {
  SEAL_DRAFT_NOT_FOUND,
  SEAL_PWA_HINT,
  SEAL_RETRY_RING,
  SEAL_SESSION_ENDED,
  SEAL_STAGING_OFFLINE,
  SEAL_STAGING_TOO_LARGE,
  SEAL_LOCAL_STORAGE_FULL,
  SEAL_VIDEO_TOO_LARGE,
  formatSealStagingTooLargeEn,
  formatSealLocalStorageInsufficientEn,
  isSealStagingTooLargeError,
  isSealLocalStorageFullError,
  isSealVideoTooLargeError,
  sealStagingLimitMb,
} from "./sealUserMessages";
