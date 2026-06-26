/**
 * Composer seal helpers — snapshot, size meter, recovery (no finalize / staging).
 */

export {
  COMPOSER_SNAPSHOT_KEY,
  composerSnapshotHasContent,
  hasRecoverableComposerContent,
  readComposerSnapshot,
  recoverComposerSnapshotToDraft,
  tryRecoverSealPrepFromComposerSnapshot,
  forceArmSealForCurrentUser,
} from "./sealComposerRecovery";

export {
  clearComposerSnapshot,
  composerSnapshotHasTextContent,
  readComposerSnapshotTextOnly,
  writeComposerSnapshotTextOnly,
} from "./composerSnapshotSafe";

export {
  assertDraftFitsLocalPersistBudget,
  assertDraftFitsSealBudget,
  buildSealStagingHandoffPayload,
  evaluateComposerSealSize,
  evaluateLocalComposerSealSize,
  estimateComposerSealSizeLight,
} from "./sealMediaPrep";

export type { ComposerSealSizeStatus } from "./sealMediaPrep";
