/**
 * Haven — English single source of truth for in-app copy.
 * Platform splits (iOS / Android / other) live here; locale bundles mirror keys in `newMemoryPageContent.js`.
 */

export type HavenPlatform = "ios" | "android" | "other";

/** Alias for consumers who prefer the shorter name */
export type Platform = HavenPlatform;

/** Face ID + ring roles — Rings, Help, marketing */
export const HAVEN_EN_LAYERED_CORE_LINE =
  "Your Face ID protects your account. Your ring gives you fast access and a special ritual for your most precious memories.";

/** @alias */
export const RING_VS_FACE_ID_SUMMARY_EN = HAVEN_EN_LAYERED_CORE_LINE;

export type HowHavenWorksRowEn = {
  action: string;
  ringRequired: string;
  recommended: string;
};

export const HAVEN_EN_HOW_HAVEN_WORKS_ROWS: readonly HowHavenWorksRowEn[] = [
  {
    action: "Open the app daily",
    ringRequired: "No (Strongly recommended)",
    recommended: "Touch your ring (fastest) or Face ID",
  },
  {
    action: "Quick notes & drafts",
    ringRequired: "No",
    recommended: "Just start writing",
  },
  {
    action: "Seal an important memory",
    ringRequired: "Yes",
    recommended: "Seal with Ring (required)",
  },
  {
    action: "Add or remove a ring",
    ringRequired: "Yes",
    recommended: "Face ID confirmation",
  },
  {
    action: "Export data",
    ringRequired: "Yes",
    recommended: "Face ID confirmation",
  },
  {
    action: "Delete sealed memories",
    ringRequired: "Yes",
    recommended: "Face ID + extra confirmation",
  },
  {
    action: "Handle a lost ring",
    ringRequired: "No",
    recommended: "Revoke from any signed-in device",
  },
];

export const HAVEN_EN_QUICK_GUIDE_SUMMARY_LINES: readonly string[] = [
  "Open daily: touch your ring for the fastest path, or use Face ID.",
  "Quick notes and drafts: just start writing.",
  "Seal memories: only a trusted ring can complete the ritual.",
];

export const HAVEN_EN_QUICK_GUIDE_ONE_LINE =
  "The ring is your magical key for speed and ceremony. Face ID keeps everything secure.";

/** Short compliance note for Pricing, Settings, upgrade modal, and in-app footers. */
export const HAVEN_CLOUD_STORAGE_DISCLAIMER_EN =
  "Cloud storage (Haven Plus only) is optional. By default, memories stay on this device. Full end-to-end encrypted cloud sync is still in development — cloud features may be limited or in beta until then. Where client-side encryption applies, we cannot read your memory content. See the Privacy Policy for details.";

const HAVEN_SECURITY_DELETE_NOTE: Record<HavenPlatform, string> = {
  ios: "Sealed memories need Face ID plus an extra confirmation before they can be removed.",
  android:
    "Sealed memories need your screen lock plus an extra confirmation before they can be removed.",
  other:
    "Sealed memories need your device lock plus an extra confirmation before they can be removed.",
};

export function mapHowHavenRowsToRingsQuickGuide(
  rows: readonly HowHavenWorksRowEn[]
): { action: string; required: string; way: string }[] {
  return rows.map((r) => ({
    action: r.action,
    required: r.ringRequired,
    way: r.recommended,
  }));
}

export function mapHowHavenRowsToHelpRows(
  rows: readonly HowHavenWorksRowEn[]
): { operation: string; ringRequired: string; recommended: string }[] {
  return rows.map((r) => ({
    operation: r.action,
    ringRequired: r.ringRequired,
    recommended: r.recommended,
  }));
}

/* -------------------------------------------------------------------------- */
/* New Memory — per-platform + shared (feeds `getNewMemoryPageCopy`)         */
/* -------------------------------------------------------------------------- */

type NewMemoryPlatformSlice = {
  heroSubtitle: string;
  sealPrimaryHint: string;
  saveSecureLink: string;
  footerReadySeal: string;
  footerWaitingRing: string;
  sealWaitingBannerBody: string;
};

const HAVEN_NEW_MEMORY_SHARED = {
  topBarTitle: "New memory",
  topBarSealing: "Sealing…",
  heroTitle: "Seal this moment",
  sealPrimaryCta: "Seal with Ring",
  sealPrimaryCtaReady: "Touch ring to seal",
  sealPrimaryCtaWaiting: "Waiting for ring touch…",
  upgradeShort: "Haven Plus unlocks Seal with Ring.",
  upgradeCta: "30-day trial when you link your ring — upgrade anytime in Rings.",
  upgradeModalTitle: "Unlock the Ritual Experience",
  upgradeModalBody:
    "Haven Plus unlocks Seal with Ring and optional cloud backup where we offer it — about 50 GB for Plus where available. Link your first ring to start a 30-day trial where available.",
  upgradeModalCloudDisclaimer: HAVEN_CLOUD_STORAGE_DISCLAIMER_EN,
  upgradeModalDismiss: "Maybe later",
  upgradeModalSubscribe: "Subscribe — $4.90/mo or $49/yr",
  upgradeModalPricingHint:
    "Pricing may vary by region—confirm at checkout. Trial availability depends on store rules.",
  footerNeedDraft: "Save a draft first — then you can seal with your ring.",
  footerSealInvite: "Tap Seal with Ring above to save and prepare — then touch your ring.",
  footerOfflineSeal:
    "You need an internet connection to finish sealing after the ring touch. Stay online or try again when you’re back.",
  cancelSealFlow: "Cancel this seal",
  sealWaitingBannerTitle: "Waiting for your ring",
  secureSaveMessage:
    "Saved securely on this device. You can come back any time and seal this memory with your ring.",
  sealAfterSecureSaveCta: "Seal this memory now",
  storyRequiredHint: "Add a few words about this moment — it’s required to seal.",
  sealCountdownPrefix: "Time left to touch:",
} as const;

const HAVEN_NEW_MEMORY_BY_PLATFORM: Record<HavenPlatform, NewMemoryPlatformSlice> = {
  ios: {
    heroSubtitle:
      "Mark this moment with a ring ritual — a lasting, intentional way to keep this memory.",
    sealPrimaryHint: "Touch your Haven ring to the top of your iPhone when you’re ready.",
    saveSecureLink: "Or save securely with Face ID",
    footerReadySeal: "Lift your ring and hold it near your iPhone to complete the ritual.",
    footerWaitingRing: "Waiting for your ring — hold it to the top of your iPhone.",
    sealWaitingBannerBody:
      "Bring your Haven ring close to your iPhone. Add Haven to your Home Screen first for the most reliable NFC handoff.",
  },
  android: {
    heroSubtitle: "Seal this memory fast with your ring — one touch completes it.",
    sealPrimaryHint: "Touch your Haven ring to the NFC area on the back of your phone.",
    saveSecureLink: "Or save securely with fingerprint / screen lock",
    footerReadySeal: "Ring is ready — one light touch finishes it.",
    footerWaitingRing: "Waiting for your ring — keep it steady near the NFC spot.",
    sealWaitingBannerBody:
      "Hold your Haven ring near the back of your phone. You should feel a quick system prompt when NFC reads the ring.",
  },
  other: {
    heroSubtitle: "Confirm this memory with your Haven ring when you’re ready.",
    sealPrimaryHint: "Use your phone’s NFC with your Haven ring to confirm.",
    saveSecureLink: "Or save securely to this device",
    footerReadySeal: "Ready — touch your ring to seal when your phone prompts you.",
    footerWaitingRing: "Waiting for your ring — follow the on-screen NFC steps.",
    sealWaitingBannerBody:
      "Hold your Haven ring near your device’s NFC reader until this step completes.",
  },
};

export type NewMemoryHeroCopy = {
  topBarTitle: string;
  heroTitle: string;
  heroSubtitle: string;
  sealPrimaryCta: string;
  sealPrimaryHint: string;
  saveSecureLink: string;
  upgradeShort: string;
  upgradeCta: string;
};

export type NewMemoryPageCopyEn = NewMemoryHeroCopy & {
  topBarSealing: string;
  sealPrimaryCtaReady: string;
  sealPrimaryCtaWaiting: string;
  footerNeedDraft: string;
  footerSealInvite: string;
  footerReadySeal: string;
  footerWaitingRing: string;
  footerOfflineSeal: string;
  cancelSealFlow: string;
  sealWaitingBannerTitle: string;
  sealWaitingBannerBody: string;
  secureSaveMessage: string;
  sealAfterSecureSaveCta: string;
  securityDeleteNote: string;
  storyRequiredHint: string;
  sealCountdownPrefix: string;
  upgradeModalTitle: string;
  upgradeModalBody: string;
  upgradeModalCloudDisclaimer: string;
  upgradeModalDismiss: string;
  upgradeModalSubscribe: string;
  upgradeModalPricingHint: string;
};

function buildNewMemoryPageCopy(platform: HavenPlatform): NewMemoryPageCopyEn {
  const p = HAVEN_NEW_MEMORY_BY_PLATFORM[platform];
  return {
    ...HAVEN_NEW_MEMORY_SHARED,
    ...p,
    securityDeleteNote: HAVEN_SECURITY_DELETE_NOTE[platform],
  };
}

export function getNewMemoryPageCopy(platform: HavenPlatform): NewMemoryPageCopyEn {
  return buildNewMemoryPageCopy(platform);
}

/** @deprecated Prefer `getNewMemoryPageCopy` — narrow hero-only slice */
export function getNewMemoryHeroCopy(platform: HavenPlatform): NewMemoryHeroCopy {
  const full = getNewMemoryPageCopy(platform);
  return {
    topBarTitle: full.topBarTitle,
    heroTitle: full.heroTitle,
    heroSubtitle: full.heroSubtitle,
    sealPrimaryCta: full.sealPrimaryCta,
    sealPrimaryHint: full.sealPrimaryHint,
    saveSecureLink: full.saveSecureLink,
    upgradeShort: full.upgradeShort,
    upgradeCta: full.upgradeCta,
  };
}

export const SAVE_SECURE_SUCCESS_LINE_EN =
  "Saved securely on this device. You can come back any time and seal this memory with your ring.";

/* -------------------------------------------------------------------------- */
/* /start — idle hero + SDM card copy                                          */
/* -------------------------------------------------------------------------- */

export type StartSdmScene = "new_ring_binding" | "daily_access" | "seal_confirmation";

export type StartSdmStateForCopy =
  | { kind: "idle" }
  | { kind: "resolving" }
  | { kind: "failed"; message: string }
  | {
      kind: "ready";
      scene: StartSdmScene;
      ringId: string | null;
      ownerId: string | null;
      viewerUserId: string | null;
    };

export type StartSdmCardCopy = {
  eyebrow: string;
  title: string;
  body: string;
  nextLine: string;
  placementHint: string | null;
};

const HAVEN_START_IDLE_HERO: Record<HavenPlatform, { title: string; subtitle: string }> = {
  ios: {
    title: "Welcome to Haven",
    subtitle:
      "Your private memory sanctuary.\nAdd Haven to your Home Screen for the smoothest ring and NFC flow.",
  },
  android: {
    title: "Welcome to Haven",
    subtitle:
      "Your private memory sanctuary.\nYour Haven ring can open the app in one tap on supported Android phones.",
  },
  other: {
    title: "Welcome to Haven",
    subtitle:
      "Your private memory sanctuary.\nLink a ring when you are ready for quick access and the Seal with Ring ritual.",
  },
};

type StartCardFields = Pick<StartSdmCardCopy, "eyebrow" | "title" | "body" | "placementHint" | "nextLine">;

const HAVEN_START_SEAL_CONFIRMATION: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "Seal in progress",
    title: "Complete the seal ritual",
    body: "Bring your Haven ring close to the top of your iPhone to finish sealing this memory.",
    nextLine: "Next: stay on this screen while Haven completes the seal.",
    placementHint: "Hold for 1–2 seconds. iOS may show an NFC sheet — that is expected.",
  },
  android: {
    eyebrow: "Seal in progress",
    title: "Touch your ring to seal",
    body: "Hold your Haven ring against the NFC zone on the back of your phone to finish sealing.",
    nextLine: "Next: stay on this screen while Haven completes the seal.",
    placementHint: "A light tap is often enough. NFC is usually near the camera on the back.",
  },
  other: {
    eyebrow: "Seal in progress",
    title: "Confirm with your ring",
    body: "Hold your Haven ring near your device’s NFC reader to finish sealing this memory.",
    nextLine: "Next: stay on this screen while Haven completes the seal.",
    placementHint:
      "Tip: hold the ring near your device’s NFC reader until this step finishes.",
  },
};

const HAVEN_START_NEW_RING_BINDING: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "New ring",
    title: "Link your first ring",
    body: "This ring is not linked yet. Sign in below, then connect it once — each ring belongs to a single Haven account at a time.",
    nextLine: "Next: sign in, then finish linking from the guided screen.",
    placementHint: "Hold your ring near the top of your iPhone to finish binding.",
  },
  android: {
    eyebrow: "New ring",
    title: "Link your first ring",
    body: "This ring is not linked yet. Sign in below, then connect it — NFC linking is quick once you are signed in.",
    nextLine: "Next: sign in, then finish linking from the guided screen.",
    placementHint: "Hold your ring against the NFC area on the back of your phone to finish binding.",
  },
  other: {
    eyebrow: "New ring",
    title: "Link your first ring",
    body: "This ring is not linked yet. Sign in below, then connect it to your account when you are ready.",
    nextLine: "Next: sign in, then finish linking from the guided screen.",
    placementHint: null,
  },
};

const HAVEN_START_DAILY_ACCESS_SELF: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "Your ring",
    title: "Ring recognized",
    body: "Welcome back — we are opening Haven for you.",
    nextLine: "Next: continuing to Memories.",
    placementHint:
      "Tip: for daily access, touch your ring to the top of your iPhone, or open Haven from your Home Screen first.",
  },
  android: {
    eyebrow: "Your ring",
    title: "Ring recognized",
    body: "Welcome back — we are opening Haven for you.",
    nextLine: "Next: continuing to Memories.",
    placementHint:
      "Tip: for daily access, touch your ring to the NFC area on the back — usually near the camera.",
  },
  other: {
    eyebrow: "Your ring",
    title: "Ring recognized",
    body: "Welcome back — we are opening Haven for you.",
    nextLine: "Next: continuing to Memories.",
    placementHint: null,
  },
};

function nfcPlacementHintWhileWaiting(platform: HavenPlatform): string {
  if (platform === "ios") {
    return "Tip: keep the ring near the top of your iPhone for 1–2 seconds. iOS may show a small NFC sheet.";
  }
  if (platform === "android") {
    return "Tip: a light tap on the back NFC zone is often enough — it is usually close to the camera bump.";
  }
  return "Tip: hold the ring near your device’s NFC reader until this step finishes.";
}

export function getStartIdleHeroCopy(platform: HavenPlatform): { title: string; subtitle: string } {
  return HAVEN_START_IDLE_HERO[platform];
}

export function getStartSdmCardCopy(
  platform: HavenPlatform,
  state: StartSdmStateForCopy
): StartSdmCardCopy {
  if (state.kind === "resolving") {
    return {
      eyebrow: "Ring tap received",
      title: "Verifying your ring",
      body: "Haven is checking the secure signature from this tap. Keep this page open and the ring steady.",
      nextLine: "Next: hold steady until verification finishes.",
      placementHint: nfcPlacementHintWhileWaiting(platform),
    };
  }

  if (state.kind === "failed") {
    return {
      eyebrow: "Could not verify",
      title: "Could not complete that tap",
      body: "Try once more with a steady hold, or confirm this ring is linked in My Rings. Your saved draft stays on this device.",
      nextLine: state.message || "Tap Retry, or return to Capture and start Seal with Ring again.",
      placementHint: nfcPlacementHintWhileWaiting(platform),
    };
  }

  if (state.kind !== "ready") {
    return {
      eyebrow: "",
      title: "",
      body: "",
      nextLine: "",
      placementHint: null,
    };
  }

  if (state.scene === "seal_confirmation") {
    return { ...HAVEN_START_SEAL_CONFIRMATION[platform] };
  }

  if (state.scene === "new_ring_binding") {
    return { ...HAVEN_START_NEW_RING_BINDING[platform] };
  }

  const self = state.viewerUserId || "";
  const owner = state.ownerId || "";

  if (self && owner && self === owner) {
    return { ...HAVEN_START_DAILY_ACCESS_SELF[platform] };
  }

  if (self && owner && self !== owner) {
    return {
      eyebrow: "Different owner",
      title: "This ring already belongs to another Haven account",
      body: "The current owner must unlink it in My Rings before you can link it here. One active link per ring.",
      nextLine: "Next: sign in with the account that owns this ring, or use a different ring.",
      placementHint: null,
    };
  }

  return {
    eyebrow: "Linked ring",
    title: "This ring is already on a Haven account",
    body: "Sign in if this ring is yours. If it is on someone else’s account, that owner needs to unlink it first.",
    nextLine: "Next: sign in or continue to browse Haven.",
    placementHint: null,
  };
}

export const START_PAGE_EN = {
  heroSubtitleFallback: "See the guided card below for the full step.",
  backToHaven: "Back to Haven",
  continueWithoutRing: "Continue without ring",
  keepSealing: "Keep sealing",
  leaveSealWarning:
    "Leave now? Your draft is safe on this device — you can resume sealing from Capture when you are ready.",
  leaveSealConfirmCta: "Leave anyway",
  retryRingTap: "Try again",
  readingRingStatus: "Reading ring status…",
  ringVerifyFailedNotice: "We could not verify that tap. Try again, or check your connection.",
  footerSecurityReminder:
    "Haven encrypts your memories on your device. Leaving this screen during a seal only pauses the ritual — nothing is published without your confirmation.",
  sealCountdownPrefix: "Time left to seal:",
} as const;

/** Post-claim / Plus trial toast copy (used from StartClient and similar) */
export const HAVEN_CLAIM_SUCCESS_EN = {
  title: "You are all set",
  bodyPlusTrial: "Your 30-day Haven Plus trial is active — try Seal with Ring from Capture.",
  bodyLinked: "Ring linked. Welcome to your sanctuary.",
} as const;

export const HAVEN_EN_ONBOARDING_PRIVACY_CANNOT_READ =
  "Where encryption is applied, we cannot read your memory content.";

const HAVEN_ONBOARDING_HOW_ROWS_PREVIEW: readonly HowHavenWorksRowEn[] =
  HAVEN_EN_HOW_HAVEN_WORKS_ROWS.slice(0, 3);

export type OnboardingStepKind = "privacy" | "how" | "ritual" | "ready";

export type OnboardingFlowStepEn = {
  id: string;
  kind: OnboardingStepKind;
  illustration: string;
  title: string;
  body?: string;
  subtitle?: string;
  bullets?: string[];
  pillars?: { label: string; text: string }[];
  howRows?: readonly HowHavenWorksRowEn[];
  primaryButton?: string;
  secondaryButton?: string;
};

export type OnboardingFlowBundleEn = {
  version: "v2";
  skip: string;
  skipLast: string;
  next: string;
  back: string;
  signInPrompt: string;
  signInWithApple: string;
  signInWithGoogle: string;
  footerPrivacyEcho: string;
  tableAction: string;
  tableRingRequired: string;
  tableRecommended: string;
  steps: OnboardingFlowStepEn[];
};

export function getOnboardingFlowEn(platform: HavenPlatform): OnboardingFlowBundleEn {
  const ritualBody =
    platform === "android"
      ? "Tap your ring to the back of your phone for instant, sacred saving when you choose the ring path."
      : platform === "ios"
        ? "Touch your ring to the top of your iPhone to seal important memories with intention when you choose the ring path."
        : "Hold your ring near your phone’s NFC reader when you choose the ring path.";
  const ritualNote =
    "Ring is optional but magical. You can still use Face ID or your screen lock.";
  return {
    version: "v2",
    skip: "Skip",
    skipLast: "Not now",
    next: "Continue",
    back: "Back",
    signInPrompt: "Already have an account?",
    signInWithApple: "Sign in with Apple",
    signInWithGoogle: "Sign in with Google",
    footerPrivacyEcho: "We can’t read your memories. They stay yours.",
    tableAction: "What you want to do",
    tableRingRequired: "Ring required",
    tableRecommended: "Recommended path",
    steps: [
      {
        id: "privacy",
        kind: "privacy",
        illustration: "welcome",
        title: "Welcome to Haven",
        subtitle: "Your private memory sanctuary.",
        bullets: [
          "Local-first by default. Strong encryption on supported flows. You stay in control.",
          HAVEN_EN_ONBOARDING_PRIVACY_CANNOT_READ,
          "Your data stays on your device unless you turn on optional cloud features.",
        ],
        primaryButton: "Continue",
      },
      {
        id: "how",
        kind: "how",
        illustration: "how-pillars",
        title: "How Haven protects your memories",
        body: HAVEN_EN_LAYERED_CORE_LINE,
        pillars: [
          { label: "Ring", text: "Speed plus a sacred ritual — whenever you choose it." },
          {
            label: "Face ID / screen lock",
            text: "Guardian of your account and every high-trust action.",
          },
          { label: "Local + optional cloud", text: "You control what leaves this device." },
        ],
        howRows: HAVEN_ONBOARDING_HOW_ROWS_PREVIEW,
        primaryButton: "Got it, continue",
      },
      {
        id: "ritual",
        kind: "ritual",
        illustration: "ritual-tap",
        title: "A small ritual for what matters most",
        body: ritualBody,
        subtitle: ritualNote,
        primaryButton: "Sounds good",
      },
      {
        id: "ready",
        kind: "ready",
        illustration: "ownership",
        title: "Ready to create your first sealed memory?",
        body: "Your first 30 days of Haven Plus are on us when you bind a ring — where that offer is available.",
        primaryButton: "Bind my first ring",
        secondaryButton: "Start with Face ID only",
      },
    ],
  };
}

/** Pricing / upgrade decision page (EN source of truth). */
export const HAVEN_PRICING_PAGE_EN = {
  pageTitle: "Haven Plus",
  heroTitle: "Unlock the full Haven experience",
  heroSubtitle:
    "Seal memories with intention. Keep them safe. You stay in control of how long they live on your devices.",
  trustLine: "Local-first • Strong encryption on supported flows • You choose what leaves your device",
  colFeature: "Feature",
  colFree: "Free",
  colPlus: "Haven Plus",
  cloudStorageDisclaimer: HAVEN_CLOUD_STORAGE_DISCLAIMER_EN,
  rows: [
    {
      feature: "Storage",
      free: "2 GB (local)",
      plus: "50 GB (local + optional cloud where offered; see disclaimer below)",
    },
    { feature: "Number of rings", free: "1", plus: "Up to 5 linked rings" },
    {
      feature: "Seal with Ring",
      free: "Not available on Free",
      plus: "Full ritual experience where offered",
    },
    {
      feature: "Save securely (Face ID / lock)",
      free: "Unlimited",
      plus: "Unlimited",
    },
    {
      feature: "Cloud backup & sync",
      free: "Not included",
      plus: "Optional cloud backup & sync where offered (see disclaimer)",
    },
    {
      feature: "Memory export / migration",
      free: "Basic export",
      plus: "Advanced tools + guided export",
    },
    {
      feature: "Priority support",
      free: "No",
      plus: "Email with faster responses where offered",
    },
    {
      feature: "Future premium features",
      free: "No",
      plus: "Early access where offered",
    },
    {
      feature: "Price",
      free: "Free",
      plus: "$4.90 / month or $49 / year (save about 16% annually)",
    },
  ],
  footnoteTrial:
    "30-day free trial when you bind your first ring — where that offer is available.",
  footnoteCancel: "Cancel anytime. No questions asked.",
  footnoteBelief:
    "We believe your memories belong to you — not to an ad platform.",
  ctaTrial: "Start 30-day free trial",
  ctaSubscribe: "Subscribe now",
  payMethodsNote:
    "Checkout may offer Apple Pay, Google Pay, or card depending on your device and region.",
  socialProof:
    "Most people who fall in love with Haven upgrade within the first week after sealing something that truly matters.",
  faqTitle: "FAQ",
  faqs: [
    {
      q: "What happens if I cancel?",
      a: "Your local memories stay on this device. Cloud features simply stop renewing — nothing is sold to advertisers.",
    },
    {
      q: "Is my data really private?",
      a: "Haven is built local-first with strong encryption on supported flows. Read the Privacy Policy in Settings for the full picture, including how cloud features work while they roll out.",
    },
    {
      q: "Can I use Haven without a ring?",
      a: "Yes. Save Securely with Face ID or your screen lock stays fully available on Free.",
    },
    {
      q: "What about data export?",
      a: "Plus includes more convenient export and migration paths where we ship them — Free still supports basic export from Settings.",
    },
  ],
  back: "Back",
} as const;

/* -------------------------------------------------------------------------- */
/* Memory detail — nested EN (SSoT); flatten via getMemoryDetailPageCopy       */
/* -------------------------------------------------------------------------- */

export const HAVEN_MEMORY_DETAIL_EN = {
  sealedBadge: "Sealed",
  /** Long calendar date, e.g. “March 12, 2026” — prefix only; date inserted in UI */
  sealedOn: "Sealed on {date}",
  sealedSecurely: "Sealed securely on this device",
  sealedWithRing: {
    ios: "Sealed with ring ritual at top of iPhone",
    android: "Sealed with ring tap on back of phone",
    other: "Sealed with ring",
  },
  e2eeFooter: "This memory is end-to-end encrypted and stored securely.",
  footerDeleteHint:
    "Deleting it requires Face ID or screen lock plus an extra confirmation.",
  menu: {
    edit: "Edit memory",
    export: "Export this memory",
    shareLink: "Copy share link (coming soon)",
    delete: "Delete memory",
  },
  deleteConfirm: {
    title: "Delete this sealed memory?",
    body: "This action cannot be undone. You will need Face ID / screen lock + extra confirmation.",
    confirm: "Yes, delete this memory",
    cancel: "Cancel",
  },
  exportChooseFormatTitle: "Choose export format",
  exportFormatJsonFull: "JSON — full memory (text and embedded media)",
  exportFormatJsonLite: "JSON — text and metadata only (no photos or files)",
  exportContinueToVerify: "Continue to verification",
  exportPreparing: "Preparing your export…",
  exportSuccess: "Memory exported successfully. Keep your files safe.",
  sharePlusOnly:
    "Share links are not available yet. We are working on safer sharing for a future update.",
  shareSuccess: "Share links are not available yet.",
  topBackLabel: "Back to Memories",
  centerFallbackTitle: "Memory",
  menuOpenAria: "More actions",
  storyHeading: "Story",
  photosHeading: "Photos",
  mediaHeading: "Media & files",
  metaHeading: "Details",
  metaToggleShow: "Show details",
  metaToggleHide: "Hide details",
  metaCreated: "Created",
  metaUpdated: "Last updated",
  metaSealed: "Sealed",
  metaSealedViaRing: "{date} via Ring",
  metaSealedOther: "{date}",
  metaReferenceId: "Reference ID",
  readOnlyBanner:
    "Tap the title to edit in the composer. Protected actions require verification before they run.",
  editRequiresVerifyTitle: "Verify to continue",
  editRequiresVerifyBody:
    "To protect sealed memories, we ask for device verification before opening the editor.",
  editContinue: "Continue to editor",
  verifyModalTitle: "Confirm with device verification",
  verifyModalBody:
    "Use your device password or recovery code to continue this protected action.",
  verifyPasswordPlaceholder: "Device password",
  verifyRecoveryPlaceholder: "Recovery code (optional)",
  verifyActionConfirm: "Verify and continue",
  verifyActionCancel: "Cancel",
  verifyActionFailed: "Verification failed. Please check and try again.",
  defaultTitle: "Memory details",
  loading: "Loading memory…",
  noMemory: "Memory not found.",
  previous: "Previous",
  next: "Next",
  noPhotos: "No photos in this memory.",
  noStory: "No written story for this moment.",
  attachmentsTitle: "Attachments",
  noAttachments: "No attachments.",
  downloadAttachment: "Download file",
  untitledAttachment: "Attachment",
  capsuleLockedTitle: "Time capsule is still locked",
  capsuleLockedBody: "This capsule unlocks at {time}. Please come back then.",
  capsuleTypeTime: "Time capsule",
  capsuleTypeNormal: "Memory",
} as const;

/** Flattened copy consumed by `MemoryDetailPage` / `getMemoryDetailUiCopy`. */
export type MemoryDetailPageCopy = {
  sealBadge: string;
  sealedOn: string;
  sealedSecurely: string;
  sealPlacementHint: string;
  e2eeFooter: string;
  footerDeleteHint: string;
  menuEdit: string;
  menuExport: string;
  menuShareLink: string;
  menuDelete: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  deleteConfirmConfirm: string;
  deleteConfirmCancel: string;
  exportChooseFormatTitle: string;
  exportFormatJsonFull: string;
  exportFormatJsonLite: string;
  exportContinueToVerify: string;
  exportPreparing: string;
  exportSuccess: string;
  sharePlusOnlyBody: string;
  shareCopiedToast: string;
  topBackLabel: string;
  centerFallbackTitle: string;
  menuOpenAria: string;
  storyHeading: string;
  photosHeading: string;
  mediaHeading: string;
  metaHeading: string;
  metaToggleShow: string;
  metaToggleHide: string;
  metaCreated: string;
  metaUpdated: string;
  metaSealed: string;
  metaSealedViaRing: string;
  metaSealedOther: string;
  metaReferenceId: string;
  readOnlyBanner: string;
  editRequiresVerifyTitle: string;
  editRequiresVerifyBody: string;
  editContinue: string;
  verifyModalTitle: string;
  verifyModalBody: string;
  verifyPasswordPlaceholder: string;
  verifyRecoveryPlaceholder: string;
  verifyActionConfirm: string;
  verifyActionCancel: string;
  verifyActionFailed: string;
  defaultTitle: string;
  loading: string;
  noMemory: string;
  previous: string;
  next: string;
  noPhotos: string;
  noStory: string;
  attachmentsTitle: string;
  noAttachments: string;
  downloadAttachment: string;
  untitledAttachment: string;
  capsuleLockedTitle: string;
  capsuleLockedBody: string;
  capsuleTypeTime: string;
  capsuleTypeNormal: string;
  securityDeleteNote: string;
};

export function getMemoryDetailPageCopy(platform: HavenPlatform): MemoryDetailPageCopy {
  const m = HAVEN_MEMORY_DETAIL_EN;
  return {
    sealBadge: m.sealedBadge,
    sealedOn: m.sealedOn,
    sealedSecurely: m.sealedSecurely,
    sealPlacementHint: m.sealedWithRing[platform],
    e2eeFooter: m.e2eeFooter,
    footerDeleteHint: m.footerDeleteHint,
    menuEdit: m.menu.edit,
    menuExport: m.menu.export,
    menuShareLink: m.menu.shareLink,
    menuDelete: m.menu.delete,
    deleteConfirmTitle: m.deleteConfirm.title,
    deleteConfirmBody: m.deleteConfirm.body,
    deleteConfirmConfirm: m.deleteConfirm.confirm,
    deleteConfirmCancel: m.deleteConfirm.cancel,
    exportChooseFormatTitle: m.exportChooseFormatTitle,
    exportFormatJsonFull: m.exportFormatJsonFull,
    exportFormatJsonLite: m.exportFormatJsonLite,
    exportContinueToVerify: m.exportContinueToVerify,
    exportPreparing: m.exportPreparing,
    exportSuccess: m.exportSuccess,
    sharePlusOnlyBody: m.sharePlusOnly,
    shareCopiedToast: m.shareSuccess,
    topBackLabel: m.topBackLabel,
    centerFallbackTitle: m.centerFallbackTitle,
    menuOpenAria: m.menuOpenAria,
    storyHeading: m.storyHeading,
    photosHeading: m.photosHeading,
    mediaHeading: m.mediaHeading,
    metaHeading: m.metaHeading,
    metaToggleShow: m.metaToggleShow,
    metaToggleHide: m.metaToggleHide,
    metaCreated: m.metaCreated,
    metaUpdated: m.metaUpdated,
    metaSealed: m.metaSealed,
    metaSealedViaRing: m.metaSealedViaRing,
    metaSealedOther: m.metaSealedOther,
    metaReferenceId: m.metaReferenceId,
    readOnlyBanner: m.readOnlyBanner,
    editRequiresVerifyTitle: m.editRequiresVerifyTitle,
    editRequiresVerifyBody: m.editRequiresVerifyBody,
    editContinue: m.editContinue,
    verifyModalTitle: m.verifyModalTitle,
    verifyModalBody: m.verifyModalBody,
    verifyPasswordPlaceholder: m.verifyPasswordPlaceholder,
    verifyRecoveryPlaceholder: m.verifyRecoveryPlaceholder,
    verifyActionConfirm: m.verifyActionConfirm,
    verifyActionCancel: m.verifyActionCancel,
    verifyActionFailed: m.verifyActionFailed,
    defaultTitle: m.defaultTitle,
    loading: m.loading,
    noMemory: m.noMemory,
    previous: m.previous,
    next: m.next,
    noPhotos: m.noPhotos,
    noStory: m.noStory,
    attachmentsTitle: m.attachmentsTitle,
    noAttachments: m.noAttachments,
    downloadAttachment: m.downloadAttachment,
    untitledAttachment: m.untitledAttachment,
    capsuleLockedTitle: m.capsuleLockedTitle,
    capsuleLockedBody: m.capsuleLockedBody,
    capsuleTypeTime: m.capsuleTypeTime,
    capsuleTypeNormal: m.capsuleTypeNormal,
    securityDeleteNote: HAVEN_SECURITY_DELETE_NOTE[platform],
  };
}

/* -------------------------------------------------------------------------- */
/* Help center — condensed structure (EN; consumed by HelpCenterPage)         */
/* -------------------------------------------------------------------------- */

export const HAVEN_HELP_CENTER_EN = {
  searchPlaceholder: "Search help topics…",
  categoryHowTitle: "How Haven Works",
  categoryHowSubtitle: "One calm overview — ring vs Face ID in one place.",
  categoryRitualTitle: "The Ring & Seal Ritual",
  categoryRitualSubtitle: "Where to tap, what to expect, iOS vs Android.",
  categoryPrivacyTitle: "Privacy & Security",
  categoryPrivacySubtitle: "What stays on-device, exports, and high-risk actions.",
  categoryBillingTitle: "Subscription & Billing",
  categoryBillingSubtitle: "Plus, trial, and cancellation in plain language.",
  categoryBillingBody:
    "Haven Plus adds Seal with Ring and optional cloud space where we ship it. You can cancel anytime.",
  categoryTroubleTitle: "Troubleshooting",
  categoryTroubleSubtitle: "NFC, lost rings, and quick fixes.",
  linkRingsCta: "Manage my rings",
  linkSettingsCta: "Open Settings",
  linkPricingCta: "View Haven Plus pricing",
  footerQuestions: "Still have questions?",
  footerEmailLine: "Email us — we read every message.",
  supportEmail: "privacy@havenring.me",
} as const;

/* -------------------------------------------------------------------------- */
/* Settings — export flow (EN; merge with settingsContent for other locales)  */
/* -------------------------------------------------------------------------- */

export const HAVEN_SETTINGS_EXPORT_EN = {
  exportSectionTitle: "Export all data",
  exportSectionLead:
    "Download everything this device holds for Haven. Choose a format, verify, then save the file somewhere safe.",
  formatJsonFull: "JSON — memories with embedded media (recommended)",
  formatJsonLite: "JSON — text & metadata only (smaller, no photos)",
  formatZipHint:
    "Full ZIP archives may be offered in a future update; JSON remains the portable standard on web.",
  preparingDetail: "Preparing your export…",
  progressLabel: "Progress",
  exportSuccessToast: "Export completed. Your data is yours.",
  exportAftercare: "Store this file somewhere only you can access — not in public folders.",
  chooseFormatTitle: "Choose export format",
  continueToVerify: "Continue",
} as const;

/* -------------------------------------------------------------------------- */
/* Aggregated tree — import `havenCopy` for marketing / future i18n keys       */
/* -------------------------------------------------------------------------- */

export const havenCopy = {
  common: {
    sealThisMoment: HAVEN_NEW_MEMORY_SHARED.heroTitle,
    ringRitualLine:
      "Your ring adds speed and ceremony; Face ID still protects your account and high-risk actions.",
    faceIdFallbackShort: "Or save securely with Face ID",
    securityDeleteNote: {
      ios: HAVEN_SECURITY_DELETE_NOTE.ios,
      android: HAVEN_SECURITY_DELETE_NOTE.android,
      general: HAVEN_SECURITY_DELETE_NOTE.other,
    },
    upgradeToPlusShort: HAVEN_NEW_MEMORY_SHARED.upgradeShort,
    thirtyDayTrialLine: HAVEN_NEW_MEMORY_SHARED.upgradeCta,
    layeredCoreLine: HAVEN_EN_LAYERED_CORE_LINE,
    quickGuideSummaryLines: [...HAVEN_EN_QUICK_GUIDE_SUMMARY_LINES],
    quickGuideOneLine: HAVEN_EN_QUICK_GUIDE_ONE_LINE,
    howHavenWorksRows: HAVEN_EN_HOW_HAVEN_WORKS_ROWS,
  },
  newMemory: {
    shared: HAVEN_NEW_MEMORY_SHARED,
    byPlatform: HAVEN_NEW_MEMORY_BY_PLATFORM,
  },
  start: {
    idleHero: HAVEN_START_IDLE_HERO,
    sealConfirmation: HAVEN_START_SEAL_CONFIRMATION,
    newRingBinding: HAVEN_START_NEW_RING_BINDING,
    dailyAccessSelf: HAVEN_START_DAILY_ACCESS_SELF,
    strings: START_PAGE_EN,
    claimSuccess: HAVEN_CLAIM_SUCCESS_EN,
  },
  rings: {
    howHavenWorksTitle: "How Haven Works",
    ringVsFaceIdSummary: HAVEN_EN_LAYERED_CORE_LINE,
    quickGuideSummaryLines: [...HAVEN_EN_QUICK_GUIDE_SUMMARY_LINES],
  },
  help: {
    howHavenWorksTitle: "How Haven Works",
    ringVsFaceIdSummary: HAVEN_EN_LAYERED_CORE_LINE,
    howHavenWorksRows: HAVEN_EN_HOW_HAVEN_WORKS_ROWS,
  },
  helpCenter: HAVEN_HELP_CENTER_EN,
  memoryDetail: HAVEN_MEMORY_DETAIL_EN,
  settingsExport: HAVEN_SETTINGS_EXPORT_EN,
  upgrade: {
    modalTitle: HAVEN_NEW_MEMORY_SHARED.upgradeModalTitle,
    modalBody: HAVEN_NEW_MEMORY_SHARED.upgradeModalBody,
    modalCloudDisclaimer: HAVEN_NEW_MEMORY_SHARED.upgradeModalCloudDisclaimer,
    pricingHint: HAVEN_NEW_MEMORY_SHARED.upgradeModalPricingHint,
    ctaSubscribe: HAVEN_NEW_MEMORY_SHARED.upgradeModalSubscribe,
    ctaDismiss: HAVEN_NEW_MEMORY_SHARED.upgradeModalDismiss,
    upgradeTimingHint: HAVEN_PRICING_PAGE_EN.socialProof,
  },
  pricingPage: HAVEN_PRICING_PAGE_EN,
  cloudStorageDisclaimer: HAVEN_CLOUD_STORAGE_DISCLAIMER_EN,
  onboarding: {
    privacyCannotRead: HAVEN_EN_ONBOARDING_PRIVACY_CANNOT_READ,
    getFlowEn: getOnboardingFlowEn,
  },
} as const;
