import { detectPlatform } from "../hooks/usePlatform";
import { getStartIdleHeroCopy } from "../content/havenCopy";

export function detectPlatformFromNavigator() {
  return detectPlatform();
}

export function getPlatformGuidance(platformInput) {
  const platform = platformInput || detectPlatformFromNavigator();
  const isIos = platform === "ios";
  const isAndroid = platform === "android";
  const havenPlat = isAndroid ? "android" : isIos ? "ios" : "other";
  const hero = getStartIdleHeroCopy(havenPlat);
  return {
    platform,
    isIos,
    isAndroid,
    startTitle: hero.title,
    startSubtitle: hero.subtitle,
    ringClaimLine: isIos
      ? "Your ring has been pre-configured to open this sanctuary. We will now connect it to your account."
      : isAndroid
        ? "Let's connect and configure your ring."
        : "Open Haven on your phone to connect your ring.",
    ringsHint: isIos
      ? "Touch your ring to quickly access your sanctuary."
      : isAndroid
        ? "Touch your ring to quickly access your sanctuary. You can also rewrite the ring link here."
        : "Ring tap works on supported mobile browsers after install.",
    sealPrimaryMode: isIos ? "secure_save" : "ring_seal",
  };
}
