/**
 * Session-scoped File handles for deferred video chunking — never serialize to IDB/relay.
 */

const handles = new Map<string, File>();

export function registerVideoFileHandle(attachmentId: string, file: File): void {
  const id = String(attachmentId || "").trim();
  if (!id || !(file instanceof File)) return;
  handles.set(id, file);
}

export function getVideoFileHandle(attachmentId: string): File | null {
  const id = String(attachmentId || "").trim();
  if (!id) return null;
  return handles.get(id) ?? null;
}

export function clearVideoFileHandle(attachmentId: string): void {
  const id = String(attachmentId || "").trim();
  if (!id) return;
  handles.delete(id);
}

export function clearAllVideoFileHandles(): void {
  handles.clear();
}
