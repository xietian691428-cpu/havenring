export function detectPlatformFromNavigator() {
  if (typeof navigator === "undefined") return "other";
  const ua = String(navigator.userAgent || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("android")) return "android";
  return "other";
}

export function getPlatformGuidance(platformInput) {
  const platform = platformInput || detectPlatformFromNavigator();
  const isIos = platform === "ios";
  const isAndroid = platform === "android";
  return {
    platform,
    isIos,
    isAndroid,
    startTitle: isIos
      ? "Welcome to Your Private Memory Sanctuary"
      : "Welcome to Your Private Memory Sanctuary",
    startSubtitle: isIos
      ? "Simple. Private. Forever. Add Haven to Home Screen for the best iPhone flow."
      : "Simple. Private. Forever. Your ring can open Haven quickly on supported devices.",
    ringClaimLine: isIos
      ? "Your ring has been pre-configured to open this sanctuary. We will now connect it to your account."
      : "Let's connect and configure your ring.",
    ringsHint: isIos
      ? "Touch your ring to quickly access your sanctuary."
      : "Touch your ring to quickly access your sanctuary. You can also rewrite the ring link here.",
    sealPrimaryMode: isIos ? "secure_save" : "ring_seal",
  };
}

