/**
 * Recover in-progress composer content when the user taps their ring before
 * explicitly pressing Seal (localStorage snapshot → idb draft + seal arm).
 */

import { saveDraftItem } from "../memories/draftBoxStore";
import { armSealFlowWithPersistence, isSealFlowArmed } from "../../../lib/seal-flow";
import {
  primeSealPrepAfterDraftPersisted,
  readPendingSealDraftIds,
} from "./sealFlowClient";

export const COMPOSER_SNAPSHOT_KEY = "haven.new_memory_draft";

export type ComposerSnapshot = {
  title?: string;
  story?: string;
  releaseAtInput?: string;
  photos?: unknown[];
};

export function readComposerSnapshot(): ComposerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPOSER_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ComposerSnapshot;
  } catch {
    return null;
  }
}

export function composerSnapshotHasContent(
  snapshot: ComposerSnapshot | null = readComposerSnapshot()
): boolean {
  if (!snapshot) return false;
  if (String(snapshot.title || "").trim()) return true;
  if (String(snapshot.story || "").trim()) return true;
  if (Array.isArray(snapshot.photos) && snapshot.photos.length > 0) return true;
  return false;
}

export function hasRecoverableComposerContent(): boolean {
  if (readPendingSealDraftIds().length > 0) return true;
  return composerSnapshotHasContent();
}

/** Persist composer snapshot to idb; returns draft id or null if nothing to save. */
export async function recoverComposerSnapshotToDraft(
  preferredId?: string
): Promise<string | null> {
  const snapshot = readComposerSnapshot();
  if (!composerSnapshotHasContent(snapshot)) return null;

  const releaseAt = snapshot?.releaseAtInput
    ? Date.parse(String(snapshot.releaseAtInput))
    : 0;

  const item = await saveDraftItem({
    id: preferredId || readPendingSealDraftIds()[0] || undefined,
    title: String(snapshot?.title || "").trim() || "Untitled memory",
    story: String(snapshot?.story || "").trim(),
    photo: Array.isArray(snapshot?.photos) ? snapshot.photos : [],
    attachments: [],
    releaseAt: Number.isFinite(releaseAt) ? releaseAt : 0,
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

  primeSealPrepAfterDraftPersisted(draftId);
  return true;
}

/**
 * Last-resort arm before /start SDM resolve when the user has draft content but
 * never pressed Seal — used so a ring tap can still finish as seal_confirmation.
 */
export async function forceArmSealForCurrentUser(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isSealFlowArmed()) return true;

  // Prefer saving live composer snapshot → draft + arm (highest success on ring tap).
  if (composerSnapshotHasContent()) {
    const fromSnapshot = await recoverComposerSnapshotToDraft();
    if (fromSnapshot) {
      primeSealPrepAfterDraftPersisted(fromSnapshot);
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
  primeSealPrepAfterDraftPersisted(draftId);
  return isSealFlowArmed();
}
