/**
 * Platform-aware limits for the memory composer — keeps iOS WebKit under memory pressure.
 */

export type ComposerPlatformLimits = {
  maxPhotos: number;
  imageMaxDim: number;
  jpegQuality: number;
  /** Compress one image at a time on memory-constrained WebKit. */
  compressSequentially: boolean;
  /** Prefer Web Worker for resize/encode (falls back on main thread). */
  useWorkerCompression: boolean;
  /** Use lightweight byte estimate instead of re-encoding all photos on each edit. */
  lightSealSizeEstimate: boolean;
  sealSizeDebounceMs: number;
};

export function isIosWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  return isIosWebKitUserAgent(navigator.userAgent);
}

export function isIosWebKitUserAgent(userAgent: string): boolean {
  return /iphone|ipad|ipod/i.test(userAgent || "");
}

export function getComposerSaveLimits(): {
  imageMaxDim: number;
  jpegQuality: number;
  recompressAboveBytes: number;
} {
  if (isIosWebKit()) {
    return {
      imageMaxDim: 1024,
      jpegQuality: 0.68,
      recompressAboveBytes: 280_000,
    };
  }
  return {
    imageMaxDim: 1280,
    jpegQuality: 0.74,
    recompressAboveBytes: 450_000,
  };
}

export function getComposerPlatformLimits(): ComposerPlatformLimits {
  if (isIosWebKit()) {
    return {
      maxPhotos: 8,
      imageMaxDim: 1280,
      jpegQuality: 0.72,
      compressSequentially: true,
      useWorkerCompression: true,
      lightSealSizeEstimate: true,
      sealSizeDebounceMs: 800,
    };
  }
  return {
    maxPhotos: 8,
    imageMaxDim: 1600,
    jpegQuality: 0.78,
    compressSequentially: false,
    useWorkerCompression: true,
    lightSealSizeEstimate: true,
    sealSizeDebounceMs: 350,
  };
}
