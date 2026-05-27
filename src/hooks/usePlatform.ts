"use client";

import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "other";

export type PlatformState = {
  platform: Platform;
  /** True after client-side UA detection has run (avoids mixed copy on first paint). */
  ready: boolean;
};

/**
 * Detect OS from user agent. Strict buckets — never maps "other" to iOS for UI copy.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  const isTouchMac = ua.includes("macintosh") && "ontouchend" in window;
  if (/iphone|ipad|ipod/.test(ua) || isTouchMac) return "ios";
  if (ua.includes("android")) return "android";
  return "other";
}

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone === true
  );
}

export function usePlatform(): PlatformState {
  const [state, setState] = useState<PlatformState>({ platform: "other", ready: false });

  useEffect(() => {
    setState({ platform: detectPlatform(), ready: true });
  }, []);

  return state;
}
