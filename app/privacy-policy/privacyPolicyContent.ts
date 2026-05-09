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
  lastUpdated: "Last updated: May 7, 2026",
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
        "Default: All your memories are stored locally on your device (PWA IndexedDB).",
        "Cloud Storage (optional, Plus users only): You may choose to enable encrypted cloud sync for backup and multi-device access. All cloud data is end-to-end encrypted — we cannot access the content.",
        "Free users have limited local storage (2 GB). Plus users receive 50 GB cloud storage.",
      ],
    },
    {
      heading: "3. Data Retention",
      bullets: [
        "Sealed memories are kept as long as you want them.",
        "When you delete your account, all data (local and cloud) will be permanently deleted within 30 days.",
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
        "We make best efforts to protect your data, but we cannot guarantee 100% availability due to technical, legal, or unforeseen circumstances. We strongly recommend maintaining your own local backups. We are not liable for data loss caused by device failure, user error, or other factors outside our direct control.",
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
