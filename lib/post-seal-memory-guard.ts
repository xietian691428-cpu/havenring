import {
  estimateOomRisk,
  getTotalMemoryCount,
  oomRiskToMemoryPressure,
  type OomRiskLevel,
} from "@/lib/ios-memory-heuristics";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export const POST_SEAL_QUIET_MS = 45_000;

type PostSealMarker = {
  at: number;
  hasLargeMedia?: boolean;
};

function readMarker(): PostSealMarker | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.postSealQuiet);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PostSealMarker;
    if (typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > POST_SEAL_QUIET_MS) {
      sessionStorage.removeItem(STORAGE_KEYS.postSealQuiet);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markPostSealComplete(opts: { hasLargeMedia?: boolean } = {}): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.postSealQuiet,
      JSON.stringify({
        at: Date.now(),
        hasLargeMedia: Boolean(opts.hasLargeMedia),
      } satisfies PostSealMarker)
    );
  } catch {
    /* quota */
  }
}

export function isPostSealQuietWindow(): boolean {
  return readMarker() != null;
}

export function wasPostSealLargeMedia(): boolean {
  return Boolean(readMarker()?.hasLargeMedia);
}

export type MemoryUsageSnapshot = {
  memoryCount: number;
  oomRisk: OomRiskLevel;
  pressure: "normal" | "elevated" | "critical";
  postSealQuiet: boolean;
  postSealLargeMedia: boolean;
};

export function estimateMemoryUsage(): MemoryUsageSnapshot {
  const oomRisk = estimateOomRisk();
  return {
    memoryCount: getTotalMemoryCount(),
    oomRisk,
    pressure: oomRiskToMemoryPressure(oomRisk),
    postSealQuiet: isPostSealQuietWindow(),
    postSealLargeMedia: wasPostSealLargeMedia(),
  };
}

export function logPostSealMemoryPressure(): void {
  if (typeof console === "undefined") return;
  console.log("Post-Seal memory pressure:", estimateMemoryUsage());
}
