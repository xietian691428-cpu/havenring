import type { Platform } from "@/src/hooks/usePlatform";

export type InstallGuideCopy = {
  pageTitle: string;
  lead: string;
  secondary: string;
  stepsTitle: string;
  steps: readonly string[];
  safetyTitle: string;
  safetyBrief: string;
  safetyDetails: readonly string[];
  safetyPrivacy: string;
  primaryCta: string;
  skipCta: string;
  installAppCta: string;
  browserHint: string;
};

const IOS: InstallGuideCopy = {
  pageTitle: "Better full-screen experience",
  lead: "iOS requires manually adding Haven to your Home Screen for an app-like experience.",
  secondary:
    "After you add it, open Haven from the new icon — NFC and daily use are more stable than staying in Safari tabs.",
  stepsTitle: "Add to Home Screen",
  steps: [
    "Tap the Share button at the bottom of Safari (or top on iPad).",
    "Choose Add to Home Screen.",
    "Keep the name as Haven (recommended), then tap Add.",
    "Return to your Home Screen and open Haven from the new icon.",
  ],
  safetyTitle: "Why this is safe",
  safetyBrief:
    "Add to Home Screen only creates a shortcut. It does not install a separate app store package or grant new permissions.",
  safetyDetails: [
    "No access to your photos, contacts, or messages is requested by this step.",
    "You can remove the icon anytime; your Haven account and memories are unchanged.",
    "Opening from Home Screen simply launches havenring.me in standalone mode.",
  ],
  safetyPrivacy:
    "During ring setup, Haven stores only a secure ring fingerprint for login checks — never the raw ring UID.",
  primaryCta: "Use this opened ring link",
  skipCta: "Continue in browser for now",
  installAppCta: "Show steps again",
  browserHint: "Use Safari on iPhone or iPad for Add to Home Screen.",
};

const ANDROID: InstallGuideCopy = {
  pageTitle: "Install Haven on your phone",
  lead: "Android can install Haven as an app from Chrome for a faster, full-screen experience.",
  secondary:
    "You get a Home Screen icon, smoother launches, and more reliable offline support for your sanctuary.",
  stepsTitle: "Install the app",
  steps: [
    "Tap the ⋮ menu in the top-right of Chrome.",
    "Choose Install app or Add to Home screen.",
    "Confirm Install when prompted.",
    "Open Haven from your app drawer or Home Screen icon.",
  ],
  safetyTitle: "Why this is safe",
  safetyBrief:
    "Installing adds a trusted shortcut to havenring.me. It does not sideload unknown code or change your account by itself.",
  safetyDetails: [
    "Chrome shows a standard install prompt you can cancel anytime.",
    "Uninstalling removes the icon; your account data stays in Haven until you delete it.",
    "Haven only uses permissions needed for memories, NFC (when supported), and sign-in.",
  ],
  safetyPrivacy:
    "Ring binding stores a secure fingerprint for verification — not your raw NFC UID in readable form.",
  primaryCta: "Continue in Haven",
  skipCta: "Continue in browser for now",
  installAppCta: "Install app now",
  browserHint: "Use Chrome on Android for the install prompt.",
};

const OTHER: InstallGuideCopy = {
  pageTitle: "Open Haven on your phone",
  lead: "For the best experience, open havenring.me on your iPhone or Android phone.",
  secondary:
    "Desktop browsers work for browsing and account settings, but ring tap and install flows are built for mobile.",
  stepsTitle: "Recommended browsers",
  steps: [
    "On iPhone: Safari → Share → Add to Home Screen.",
    "On Android: Chrome → menu → Install app or Add to Home screen.",
    "Then sign in at /start or open the app from your new icon.",
  ],
  safetyTitle: "Why this is safe",
  safetyBrief:
    "Haven only adds a Home Screen shortcut or lightweight install wrapper around our site — no hidden background access.",
  safetyDetails: [
    "You stay in control: remove the icon or clear site data anytime.",
    "Sign-in uses the same Supabase account security as the website.",
  ],
  safetyPrivacy:
    "Memories default to on-device storage in the app; cloud sync is optional and encrypted when enabled.",
  primaryCta: "Open Haven app",
  skipCta: "Back to website",
  installAppCta: "",
  browserHint: "Use Chrome or Safari on a phone for install and NFC.",
};

export function getInstallGuideCopy(platform: Platform): InstallGuideCopy {
  if (platform === "ios") return IOS;
  if (platform === "android") return ANDROID;
  return OTHER;
}
