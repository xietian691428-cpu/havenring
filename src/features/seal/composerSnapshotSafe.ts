/**
 * Text-only composer snapshots in localStorage.
 * Photo base64 must never be stored here — iOS Safari and Android Chrome both
 * hit quota / memory limits and can crash the WebView during JSON.stringify/parse.
 */

export const COMPOSER_SNAPSHOT_KEY = "haven.new_memory_draft";

/** Reject oversized legacy snapshots (often contained photo base64). */
const MAX_SNAPSHOT_RAW_BYTES = 256 * 1024;

export type ComposerSnapshotText = {
  title?: string;
  story?: string;
  releaseAtInput?: string;
};

export function readComposerSnapshotTextOnly(): ComposerSnapshotText | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPOSER_SNAPSHOT_KEY);
    if (!raw) return null;
    if (raw.length > MAX_SNAPSHOT_RAW_BYTES) {
      window.localStorage.removeItem(COMPOSER_SNAPSHOT_KEY);
      return null;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      title: typeof parsed.title === "string" ? parsed.title : undefined,
      story: typeof parsed.story === "string" ? parsed.story : undefined,
      releaseAtInput:
        typeof parsed.releaseAtInput === "string" ? parsed.releaseAtInput : undefined,
    };
  } catch {
    try {
      window.localStorage.removeItem(COMPOSER_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeComposerSnapshotTextOnly(snapshot: ComposerSnapshotText): boolean {
  if (typeof window === "undefined") return false;
  try {
    const payload = JSON.stringify({
      title: snapshot.title ?? "",
      story: snapshot.story ?? "",
      releaseAtInput: snapshot.releaseAtInput ?? "",
    });
    if (payload.length > MAX_SNAPSHOT_RAW_BYTES) return false;
    window.localStorage.setItem(COMPOSER_SNAPSHOT_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function clearComposerSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPOSER_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function composerSnapshotHasTextContent(
  snapshot: ComposerSnapshotText | null = readComposerSnapshotTextOnly()
): boolean {
  if (!snapshot) return false;
  if (String(snapshot.title || "").trim()) return true;
  if (String(snapshot.story || "").trim()) return true;
  if (String(snapshot.releaseAtInput || "").trim()) return true;
  return false;
}
