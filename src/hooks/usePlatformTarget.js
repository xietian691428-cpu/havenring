import { useMemo } from "react";

function detectPlatformFromUserAgent(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  const hasTouchMac = ua.includes("macintosh") && "ontouchend" in window;
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod") || hasTouchMac) {
    return "ios";
  }
  if (ua.includes("android")) {
    return "android";
  }
  return "other";
}

/**
 * iOS-first platform detection:
 * - Detect iOS/Android from user agent when possible
 * - Fallback defaults to iOS guidance for safer first-time NFC onboarding
 */
export function resolvePlatformTarget() {
  if (typeof navigator === "undefined") return "ios";
  const detected = detectPlatformFromUserAgent(navigator.userAgent);
  return detected === "other" ? "ios" : detected;
}

export function usePlatformTarget() {
  return useMemo(() => resolvePlatformTarget(), []);
}
