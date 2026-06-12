/**
 * Recover in-progress composer content when the user taps their ring before
 * explicitly pressing Seal (text-only localStorage snapshot → idb draft).
 * Does NOT arm seal — idle ring tap shows a short ack on /start only.
 */

import { getDraftItem, saveDraftItem } from "../memories/draftBoxStore";
import { isSealFlowArmed } from "../../../lib/seal-flow";
import { readPendingSealDraftIds } from "./sealFlowClient";
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
 * Rehydrate idb draft from composer snapshot only — never arms seal for NFC.
 */
export async function tryRecoverSealPrepFromComposerSnapshot(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (isSealFlowArmed()) return true;
  const draftId = await recoverComposerSnapshotToDraft();
  return Boolean(draftId);
}

/**
 * @deprecated Ring taps must not arm seal. Returns true only if already armed.
 */
export async function forceArmSealForCurrentUser(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return isSealFlowArmed();
}
