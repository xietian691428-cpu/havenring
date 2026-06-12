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
      ? "Link your ring for sealing."
      : isAndroid
        ? "Link your ring for sealing."
        : "Open Haven on your phone to link your ring.",
    ringsHint: isIos
      ? "Touch your ring when you seal a memory."
      : isAndroid
        ? "Touch your ring when you seal. You can rewrite the ring link here."
        : "Ring tap works on supported mobile browsers after install.",
    sealPrimaryMode: isIos ? "secure_save" : "ring_seal",
  };
}
