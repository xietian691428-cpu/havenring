import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type PrivacyPolicyContent = {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: Array<{
    heading: string;
    body?: string;
    bullets?: string[];
  }>;
  closing: string;
  returnLabel: string;
};

const FINAL_PRIVACY_POLICY: PrivacyPolicyContent = {
  title: "Privacy Policy",
  lastUpdated: "Last updated: May 14, 2026",
  intro:
    "At Haven, we believe your memories are deeply personal and should remain under your control. We are committed to maximum transparency and minimal data collection.",
  sections: [
    {
      heading: "1. Data We Collect",
      bullets: [
        "Account information (via Apple Sign In or Google Sign In)",
        "Memories you create (text, photos, videos, audio) — stored primarily on your device",
        "Technical data (device type, app version, usage statistics)",
      ],
    },
    {
      heading: "2. Data Storage",
      bullets: [
        "Free plan: memories stay on your device only, in encrypted local storage (IndexedDB).",
        "Haven Plus: local storage plus optional end-to-end encrypted cloud backup and sync for your private pair where available.",
        "We cannot access your memory content where client-side encryption applies.",
        "Free plan includes about 2 GB of local storage. Plus includes expanded storage and optional cloud capacity where offered.",
        "Cloud features may be limited or in beta while full E2EE sync rolls out.",
      ],
    },
    {
      heading: "3. Data Retention",
      bullets: [
        "Sealed memories remain on your devices until you delete them.",
        "If you cancel Haven Plus, cloud copies remain available to download for 30 days, then are deleted automatically. Local copies on your device are not removed by cancellation alone.",
        "When you delete your account, local and cloud data are typically removed within 30 days.",
      ],
    },
    {
      heading: "4. Your Rights",
      bullets: [
        "You can export all your data at any time.",
        "You can delete individual memories or your entire account.",
        "You can revoke ring access instantly.",
        "You can stop cloud sync and delete cloud data.",
      ],
    },
    {
      heading: "5. Important Disclaimer",
      body:
        "We make best efforts to protect your data, but no cloud or device service can promise perfect availability. We strongly recommend maintaining your own local backups. We are not liable for data loss caused by device failure, user error, or other factors outside our direct control.",
    },
    {
      heading: "6. Children",
      body: "Haven is not intended for users under 13 years old.",
    },
    {
      heading: "Contact",
      body: "For any privacy questions: privacy@havenring.me",
    },
  ],
  closing: "By using Haven, you agree to this Privacy Policy.",
  returnLabel: "Return",
};

export const PRIVACY_POLICY_CONTENT: Record<Locale, PrivacyPolicyContent> = {
  en: FINAL_PRIVACY_POLICY,
  fr: FINAL_PRIVACY_POLICY,
  es: FINAL_PRIVACY_POLICY,
  de: FINAL_PRIVACY_POLICY,
  it: FINAL_PRIVACY_POLICY,
};

export function getPrivacyPolicyContent(locale: string | null | undefined) {
  const key = String(locale || "").toLowerCase().split("-")[0] as Locale;
  return PRIVACY_POLICY_CONTENT[key] || PRIVACY_POLICY_CONTENT[DEFAULT_LOCALE];
}
