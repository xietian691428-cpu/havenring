import type { PendingMoment } from "@/lib/store";

const PENDING_MOMENT_KEY = "haven.pending_moment";

export function readPendingMomentSnapshot(): PendingMoment | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_MOMENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingMoment>;
    if (
      typeof parsed.momentId === "string" &&
      typeof parsed.ringId === "string" &&
      typeof parsed.stagedAt === "number"
    ) {
      return {
        momentId: parsed.momentId,
        ringId: parsed.ringId,
        stagedAt: parsed.stagedAt,
      };
    }
  } catch {
    // Ignore malformed local state and self-heal by clearing it.
  }
  window.localStorage.removeItem(PENDING_MOMENT_KEY);
  return null;
}

export function writePendingMomentSnapshot(pending: PendingMoment) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_MOMENT_KEY, JSON.stringify(pending));
}

export function clearPendingMomentSnapshot() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_MOMENT_KEY);
}
