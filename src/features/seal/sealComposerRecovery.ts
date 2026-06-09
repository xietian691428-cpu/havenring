/**
 * Recover in-progress composer content when the user taps their ring before
 * explicitly pressing Seal (text-only localStorage snapshot → idb draft + seal arm).
 */

import { getDraftItem, saveDraftItem } from "../memories/draftBoxStore";
import { armSealFlowWithPersistence, isSealFlowArmed } from "../../../lib/seal-flow";
import {
  primeSealPrepAfterDraftPersisted,
  readPendingSealDraftIds,
} from "./sealFlowClient";
import {
  COMPOSER_SNAPSHOT_KEY,
  composerSnapshotHasTextContent,
  readComposerSnapshotTextOnly,
  type ComposerSnapshotText,
} from "./composerSnapshotSafe";

export { COMPOSER_SNAPSHOT_KEY };

export type ComposerSnapshot = ComposerSnapshotText;

export function readComposerSnapshot(): ComposerSnapshotText | null {
  return readComposerSnapshotTextOnly();
}

export function composerSnapshotHasContent(
  snapshot: ComposerSnapshotText | null = readComposerSnapshotTextOnly()
): boolean {
  return composerSnapshotHasTextContent(snapshot);
}

export function hasRecoverableComposerContent(): boolean {
  if (readPendingSealDraftIds().length > 0) return true;
  return composerSnapshotHasTextContent();
}

/** Persist text snapshot to idb; photos stay in idb drafts from explicit Seal saves. */
export async function recoverComposerSnapshotToDraft(
  preferredId?: string
): Promise<string | null> {
  const snapshot = readComposerSnapshotTextOnly();
  if (!composerSnapshotHasTextContent(snapshot)) return null;

  const releaseAt = snapshot?.releaseAtInput
    ? Date.parse(String(snapshot.releaseAtInput))
    : 0;

  const draftId = preferredId || readPendingSealDraftIds()[0] || undefined;
  const existing = draftId ? await getDraftItem(draftId) : null;
  const existingPhotos = Array.isArray(existing?.photo) ? existing.photo : [];
  const existingAttachments = Array.isArray(existing?.attachments)
    ? existing.attachments
    : [];

  const item = await saveDraftItem({
    id: draftId,
    title: String(snapshot?.title || "").trim() || "Untitled memory",
    story: String(snapshot?.story || "").trim(),
    photo: existingPhotos,
    attachments: existingAttachments,
    releaseAt: Number.isFinite(releaseAt) ? releaseAt : 0,
    createdAt: existing?.createdAt,
  });
  return item.id;
}

/**
 * If seal prep is not armed, rehydrate from pending draft ids or composer snapshot.
 * @returns true when the next ring tap can use seal_confirmation.
 */
export async function tryRecoverSealPrepFromComposerSnapshot(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isSealFlowArmed()) return true;

  const pending = readPendingSealDraftIds();
  if (pending.length) {
    armSealFlowWithPersistence(pending);
    return true;
  }

  const draftId = await recoverComposerSnapshotToDraft();
  if (!draftId) return false;

  await primeSealPrepAfterDraftPersisted(draftId);
  return true;
}

/**
 * Last-resort arm before /start SDM resolve when the user has draft content but
 * never pressed Seal — used so a ring tap can still finish as seal_confirmation.
 */
export async function forceArmSealForCurrentUser(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isSealFlowArmed()) return true;

  const pendingBeforeSnapshot = readPendingSealDraftIds();
  if (pendingBeforeSnapshot.length) {
    armSealFlowWithPersistence(pendingBeforeSnapshot);
    return true;
  }

  if (composerSnapshotHasTextContent()) {
    const fromSnapshot = await recoverComposerSnapshotToDraft();
    if (fromSnapshot) {
      await primeSealPrepAfterDraftPersisted(fromSnapshot);
      if (isSealFlowArmed()) return true;
    }
  }

  const pending = readPendingSealDraftIds();
  if (pending.length) {
    armSealFlowWithPersistence(pending);
    return true;
  }

  const recovered = await tryRecoverSealPrepFromComposerSnapshot();
  if (recovered || isSealFlowArmed()) return true;

  if (!hasRecoverableComposerContent()) return false;
  const draftId = await recoverComposerSnapshotToDraft();
  if (!draftId) return false;
  await primeSealPrepAfterDraftPersisted(draftId);
  return isSealFlowArmed();
}
