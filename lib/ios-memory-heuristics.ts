import { isLowMemoryEntryDevice } from "@/lib/entry-defer";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { STORAGE_KEYS } from "@/lib/storage-keys";

export type OomRiskLevel = "low" | "medium" | "high";

/** Conservative average for estimated photo load without scanning photoEnc. */
export const AVG_PHOTOS_PER_MEMORY = 2;

const PHOTO_COUNT_MEDIUM = 100;
const PHOTO_COUNT_HIGH_OLD_DEVICE = 50;

type OomRiskSnapshot = {
  totalMemories: number;
  at: number;
};

function readSnapshot(): OomRiskSnapshot | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.oomRiskSnapshot);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OomRiskSnapshot;
    if (typeof parsed.totalMemories !== "number" || typeof parsed.at !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(totalMemories: number): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.oomRiskSnapshot,
      JSON.stringify({ totalMemories, at: Date.now() } satisfies OomRiskSnapshot)
    );
  } catch {
    /* quota */
  }
}

export function getTotalMemoryCount(): number {
  return readSnapshot()?.totalMemories ?? 0;
}

export function getFlag(key: "last_save_oom"): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    if (key === "last_save_oom") {
      return sessionStorage.getItem(STORAGE_KEYS.lastSaveOom) === "1";
    }
    return false;
  } catch {
    return false;
  }
}

export function markLastSaveOom(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.lastSaveOom, "1");
  } catch {
    /* quota */
  }
}

export function clearLastSaveOom(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.lastSaveOom);
  } catch {
    /* ignore */
  }
}

export function setCachedMemoryCount(totalMemories: number): void {
  writeSnapshot(Math.max(0, totalMemories));
}

/** Refresh memory count from IDB — call once on /app boot and after save/delete. */
export async function refreshOomRiskSnapshot(
  countMemories: () => Promise<number>
): Promise<OomRiskLevel> {
  try {
    const totalMemories = await countMemories();
    writeSnapshot(totalMemories);
  } catch {
    /* keep prior snapshot */
  }
  return estimateOomRisk();
}

export function estimateOomRisk(): OomRiskLevel {
  if (!isIosWebKit()) return "low";

  const totalMemories = getTotalMemoryCount();
  const photoCount = totalMemories * AVG_PHOTOS_PER_MEMORY;
  const recentSaveFailed = getFlag("last_save_oom");
  const deviceOld = isLowMemoryEntryDevice();

  if (deviceOld && (photoCount > PHOTO_COUNT_HIGH_OLD_DEVICE || recentSaveFailed)) {
    return "high";
  }
  if (photoCount > PHOTO_COUNT_MEDIUM || recentSaveFailed) return "medium";
  return "low";
}

export function shouldBlockSaveForOomRisk(): boolean {
  return estimateOomRisk() === "high";
}

export function getOomRiskSaveBlockMessage(): string {
  return "This device is low on memory — remove some photos or restart Safari, then try again.";
}

/** Session-scoped: medium/high disables timeline thumb decode on iOS. */
export function shouldDisableTimelineThumbsForOomRisk(): boolean {
  if (!isIosWebKit()) return estimateOomRisk() === "high";
  return estimateOomRisk() !== "low";
}

/** Extend iOS boot sync quiet window when memory pressure is elevated. */
export function getOomRiskSyncDelayMs(baseMs: number): number {
  const risk = estimateOomRisk();
  if (risk === "high") return Math.round(baseMs * 2.5);
  if (risk === "medium") return Math.round(baseMs * 1.6);
  return baseMs;
}

export function oomRiskToMemoryPressure(
  risk: OomRiskLevel
): "normal" | "elevated" | "critical" {
  if (risk === "high") return "critical";
  if (risk === "medium") return "elevated";
  return "normal";
}
