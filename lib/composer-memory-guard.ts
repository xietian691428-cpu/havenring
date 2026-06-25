import { STORAGE_KEYS } from "@/lib/storage-keys";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { SEAL_LOCAL_MAX_BYTES } from "@/lib/seal-staging-shared";
import {
  estimateOomRisk,
  oomRiskToMemoryPressure,
  shouldBlockSaveForOomRisk,
} from "@/lib/ios-memory-heuristics";

export type MemoryPressure = "normal" | "elevated" | "critical";

type PerfMemory = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const ESTIMATED_CRITICAL_BYTES = 80 * 1024 * 1024;
const ESTIMATED_ELEVATED_BYTES = 48 * 1024 * 1024;

/** iOS composer — bytes in the current draft, not library size. */
const IOS_COMPOSER_ELEVATED_BYTES = 32 * 1024 * 1024;
const IOS_COMPOSER_CRITICAL_BYTES = 64 * 1024 * 1024;
/** Hard block only near the local-first persist cap (300MB product budget). */
const IOS_COMPOSER_SAVE_BLOCK_BYTES = Math.floor(SEAL_LOCAL_MAX_BYTES * 0.95);

/** Reject camera-roll picks above this before decode (iOS) — compress down after pick. */
export const IOS_MAX_SOURCE_PHOTO_BYTES = 25 * 1024 * 1024;

export function readPerformanceMemory(): PerfMemory | null {
  if (typeof performance === "undefined") return null;
  const memory = (performance as Performance & { memory?: PerfMemory }).memory;
  if (!memory?.usedJSHeapSize || !memory?.jsHeapSizeLimit) return null;
  return memory;
}

export function estimateComposerMediaBytes(
  photos: unknown[] = [],
  attachments: unknown[] = []
): number {
  let total = 0;
  for (const row of [...photos, ...attachments]) {
    if (!row || typeof row !== "object") continue;
    const dataUrl = (row as { dataUrl?: string }).dataUrl;
    if (typeof dataUrl === "string" && dataUrl.length > 0) {
      total += Math.ceil((dataUrl.length * 3) / 4);
      continue;
    }
    const blob = (row as { blob?: Blob }).blob;
    if (blob instanceof Blob && blob.size > 0) {
      total += blob.size;
      continue;
    }
    const size = Number((row as { size?: number }).size || 0);
    if (size > 0) total += size;
  }
  return total;
}

export function readMemoryPressure(estimatedComposerBytes = 0): MemoryPressure {
  if (isIosWebKit()) {
    return oomRiskToMemoryPressure(estimateOomRisk());
  }

  const perf = readPerformanceMemory();
  if (perf) {
    const ratio = perf.usedJSHeapSize / perf.jsHeapSizeLimit;
    if (ratio >= 0.88) return "critical";
    if (ratio >= 0.72) return "elevated";
    return "normal";
  }

  if (estimatedComposerBytes >= ESTIMATED_CRITICAL_BYTES) return "critical";
  if (estimatedComposerBytes >= ESTIMATED_ELEVATED_BYTES) return "elevated";
  return "normal";
}

/**
 * Composer-only pressure — library size must not block adding one photo while editing.
 */
export function readComposerMemoryPressure(estimatedComposerBytes = 0): MemoryPressure {
  if (!isIosWebKit()) {
    return readMemoryPressure(estimatedComposerBytes);
  }
  if (estimatedComposerBytes >= IOS_COMPOSER_CRITICAL_BYTES) return "critical";
  if (estimatedComposerBytes >= IOS_COMPOSER_ELEVATED_BYTES) return "elevated";
  const libraryRisk = estimateOomRisk();
  if (libraryRisk === "high" && estimatedComposerBytes > 5 * 1024 * 1024) {
    return "elevated";
  }
  if (libraryRisk === "medium" && estimatedComposerBytes > 9 * 1024 * 1024) {
    return "elevated";
  }
  return "normal";
}

export function shouldPauseComposerPhotoAdd(estimatedComposerBytes: number): boolean {
  const pressure = readComposerMemoryPressure(estimatedComposerBytes);
  return pressure === "critical" && estimatedComposerBytes >= IOS_COMPOSER_ELEVATED_BYTES;
}

/** Block save only when this draft exceeds the local persist cap. */
export function shouldBlockComposerSave(estimatedComposerBytes = 0): boolean {
  if (!isIosWebKit()) {
    return shouldBlockSaveForOomRisk();
  }
  return estimatedComposerBytes >= IOS_COMPOSER_SAVE_BLOCK_BYTES;
}

export function shouldPauseForMemoryPressure(pressure: MemoryPressure): boolean {
  return pressure === "critical";
}

export type CompressionProfile = {
  imageMaxDim: number;
  jpegQuality: number;
};

export function getCompressionProfileForPressure(
  pressure: MemoryPressure,
  base: CompressionProfile
): CompressionProfile {
  if (pressure === "critical") {
    return { imageMaxDim: Math.min(base.imageMaxDim, 960), jpegQuality: 0.62 };
  }
  if (pressure === "elevated") {
    return { imageMaxDim: Math.min(base.imageMaxDim, 1120), jpegQuality: 0.68 };
  }
  return base;
}

export function markComposerMemoryStress(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEYS.composerMemoryStress, "1");
  } catch {
    /* ignore quota */
  }
}

export function consumeComposerMemoryStressFlag(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    const flagged = sessionStorage.getItem(STORAGE_KEYS.composerMemoryStress) === "1";
    if (flagged) sessionStorage.removeItem(STORAGE_KEYS.composerMemoryStress);
    return flagged;
  } catch {
    return false;
  }
}

export function isLikelyMemoryCrashError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  return (
    lower.includes("out of memory") ||
    lower.includes("memory") ||
    lower.includes("allocation failed") ||
    lower.includes("invalid array length") ||
    lower.includes("array buffer allocation")
  );
}
