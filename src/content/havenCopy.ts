/**
 * Haven — English single source of truth for in-app copy.
 * Platform splits (iOS / Android / other) live here; locale bundles mirror keys in `newMemoryPageContent.js`.
 */

import { wasPostSealLargeMedia } from "@/lib/post-seal-memory-guard";

export type HavenPlatform = "ios" | "android" | "other";

/** Alias for consumers who prefer the shorter name */
export type Platform = HavenPlatform;

/** Personal sanctuary + seal ritual — details in Help */
export const HAVEN_EN_LAYERED_CORE_LINE =
  "Sign in to browse your memories. Touch your ring only when you seal.";

/** Product model one-liner (landing, pricing, Help). */
export const HAVEN_PRODUCT_MODEL_EN =
  "Your private memory sanctuary. Sealed on device first. Plus: optional encrypted cloud backup when you choose.";

/** Sealed memories are immutable after the ritual. */
export const HAVEN_SEAL_IMMUTABLE_EN =
  "Sealed content cannot be edited. View, export, or delete with verification.";

/** @alias */
export const RING_VS_FACE_ID_SUMMARY_EN = HAVEN_EN_LAYERED_CORE_LINE;

export type HowHavenWorksRowEn = {
  action: string;
  ringRequired: string;
  recommended: string;
};

export const HAVEN_EN_HOW_HAVEN_WORKS_ROWS: readonly HowHavenWorksRowEn[] = [
  {
    action: "Open the app",
    ringRequired: "No",
    recommended: "Sign in with Apple, Google, or Email",
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
  "Sign in to read and write on this device.",
  "Seal with Ring: write, then touch your ring once.",
];

export const HAVEN_EN_QUICK_GUIDE_ONE_LINE =
  "Your ring confirms a seal — not your daily sign-in. See Help for details.";

/** Short compliance note for Pricing, Settings, upgrade modal, and in-app footers. */
export const HAVEN_CLOUD_STORAGE_DISCLAIMER_EN =
  "Memories are sealed on your device first. Haven Plus adds optional encrypted cloud backup in the background (50 GB cap). See Privacy Policy and Help.";

/** Where we explain local vs cloud storage (settings, upgrade, seal success). */
export const HAVEN_STORAGE_MODE_EN = {
  freeLocal:
    "Your sealed memories stay on this device — encrypted and available immediately after you seal.",
  plusDual:
    "Haven Plus: optional encrypted cloud backup runs in the background when you choose.",
  cancelPlus:
    "If you cancel Plus, you can download cloud backups for 30 days; after that, cloud copies are removed automatically. Memories on your device are not deleted.",
  sealSuccess:
    "Sealed on this device.",
} as const;

export const BIND_SUCCESS_EN = {
  title: "Ring linked",
  subtitle: "You're all set.",
  pairPromptTitle: "",
  pairPromptBody: "",
  pairPromptYes: "",
  pairPromptNo: "",
  pairActiveNote: "",
  sealFirstMemoryCta: "Write your first memory",
  goToMemoriesCta: "Open shared memories",
  plusTrialNote: "Plus trial active.",
} as const;

export const CLOUD_STORAGE_EN = {
  quotaSummary: "Plus cloud backup: 50 GB shared per Haven (one subscription per Pair).",
  fullMessage: "Storage full. Upgrade or delete old memories.",
} as const;

export const RING_READY_BADGE_EN = {
  ready: "Ring Ready",
  notLinked: "Link a ring to seal with a touch",
} as const;

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
  upgradeShort: "Haven Plus includes Seal with Ring.",
  upgradeCta: "30-day trial when you link your ring — upgrade anytime in Rings.",
  upgradeModalTitle: "Haven Plus",
  upgradeModalBody:
    "Haven Plus includes Seal with Ring and optional encrypted cloud backup. See Help for plans and sharing.",
  upgradeModalCloudDisclaimer: HAVEN_CLOUD_STORAGE_DISCLAIMER_EN,
  upgradeModalDismiss: "Maybe later",
  upgradeModalSubscribe: "Subscribe — $4.90/mo or $49/yr",
  upgradeModalPricingHint:
    "Pricing may vary by region—confirm at checkout. Trial availability depends on store rules.",
  footerNeedDraft: "Save a draft first — then you can seal with your ring.",
  footerSealInvite: "When you're ready, save or seal below — then touch your ring.",
  footerOfflineSeal:
    "You need an internet connection to finish sealing after the ring touch. Stay online or try again when you’re back.",
  cancelSealFlow: "Cancel this seal",
  sealWaitingBannerTitle: "Waiting for your ring",
  secureSaveMessage:
    "Saved securely on this device. You can come back any time and seal this memory with your ring.",
  sealAfterSecureSaveCta: "Seal this memory now",
  storyRequiredHint: "Add a few words about this moment — it’s required to seal.",
  sealCountdownPrefix: "Time left to touch:",
  sealStepUpSetupRequired:
    "Set up your device password in Settings before you can seal with your ring.",
  sealVerifyTitle: "Confirm it's you",
  sealVerifyHint:
    "Your screen was locked or Haven was in the background. Enter your device password or recovery code to seal again.",
  sealVerifyConfirm: "Verify and seal",
  sealVerifyCancel: "Cancel",
  backgroundDraftSaved: "Saved to Draft Box",
  sealStagingErrorTitle: "Not enough local storage",
  sealStagingTooLarge:
    "Not enough local storage — try removing older memories or saving in smaller parts.",
  sealLocalStorageErrorTitle: "Not enough local storage",
  sealLocalStorageInsufficient:
    "Not enough local storage — try removing older memories or saving in smaller parts.",
  sealSizeMeterOk: "About {used} MB of {limit} MB on this device.",
  sealSizeMeterOver:
    "About {used} MB — not enough space on this device. Remove older memories or free storage.",
} as const;

const HAVEN_NEW_MEMORY_BY_PLATFORM: Record<HavenPlatform, NewMemoryPlatformSlice> = {
  ios: {
    heroSubtitle:
      "Mark this moment with a ring ritual — a lasting, intentional way to keep this memory.",
    sealPrimaryHint: "Touch your Haven ring to the top of your iPhone when you’re ready.",
    saveSecureLink: "Save securely",
    footerReadySeal: "Lift your ring and hold it near your iPhone to complete the ritual.",
    footerWaitingRing: "Waiting for your ring — hold it to the top of your iPhone.",
    sealWaitingBannerBody:
      "Bring your Haven ring close to your iPhone. Add Haven to your Home Screen first for the most reliable NFC handoff.",
  },
  android: {
    heroSubtitle: "Seal this memory fast with your ring — one touch completes it.",
    sealPrimaryHint: "Touch your Haven ring to the NFC area on the back of your phone.",
    saveSecureLink: "Save securely",
    footerReadySeal: "Ring is ready — one light touch finishes it.",
    footerWaitingRing: "Waiting for your ring — keep it steady near the NFC spot.",
    sealWaitingBannerBody:
      "Hold your Haven ring near the back of your phone. You should feel a quick system prompt when NFC reads the ring.",
  },
  other: {
    heroSubtitle: "Confirm this memory with your Haven ring when you’re ready.",
    sealPrimaryHint: "Use your phone’s NFC with your Haven ring to confirm.",
    saveSecureLink: "Save securely",
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
  sealStepUpSetupRequired: string;
  sealVerifyTitle: string;
  sealVerifyHint: string;
  sealVerifyConfirm: string;
  sealVerifyCancel: string;
  backgroundDraftSaved: string;
  sealStagingErrorTitle: string;
  sealStagingTooLarge: string;
  sealLocalStorageErrorTitle: string;
  sealLocalStorageInsufficient: string;
  sealSizeMeterOk: string;
  sealSizeMeterOver: string;
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
      /** @deprecated Legacy pair field from SDM resolve — not used for gating (Phase 5). */
      currentUserIsHavenMember?: boolean;
      resolvedUid?: string | null;
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
    title: "Tap your ring",
    subtitle: "",
  },
  android: {
    title: "Tap your ring",
    subtitle: "",
  },
  other: {
    title: "Tap your ring",
    subtitle: "",
  },
};

type StartCardFields = Pick<StartSdmCardCopy, "eyebrow" | "title" | "body" | "placementHint" | "nextLine">;

const HAVEN_START_SEAL_CONFIRMATION: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "",
    title: "Sealing your memory...",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  android: {
    eyebrow: "",
    title: "Sealing your memory...",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  other: {
    eyebrow: "",
    title: "Sealing your memory...",
    body: "",
    nextLine: "",
    placementHint: null,
  },
};

const HAVEN_START_NEW_RING_BINDING: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "",
    title: "Bind this ring to your account?",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  android: {
    eyebrow: "",
    title: "Bind this ring to your account?",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  other: {
    eyebrow: "",
    title: "Bind this ring to your account?",
    body: "",
    nextLine: "",
    placementHint: null,
  },
};

/** Idle ring tap (legacy daily_access scene) — ring does not open the app. */
const HAVEN_START_IDLE_RING_TAP: Record<HavenPlatform, StartCardFields> = {
  ios: {
    eyebrow: "",
    title: "Open the app to seal a memory.",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  android: {
    eyebrow: "",
    title: "Open the app to seal a memory.",
    body: "",
    nextLine: "",
    placementHint: null,
  },
  other: {
    eyebrow: "",
    title: "Open the app to seal a memory.",
    body: "",
    nextLine: "",
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
    const hold = getNfcHoldGuideCopy(platform);
    return {
      eyebrow: "",
      title: hold.resolvingTitle,
      body: hold.resolvingSubtitle,
      nextLine: hold.holdSteadyLine,
      placementHint: null,
    };
  }

  if (state.kind === "failed") {
    const hold = getNfcHoldGuideCopy(platform);
    return {
      eyebrow: "",
      title: hold.failedTitle,
      body: state.message || hold.failedSubtitle,
      nextLine: hold.waitStep,
      placementHint: null,
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

  return { ...HAVEN_START_IDLE_RING_TAP[platform] };
}

export type NfcHoldGuideCopy = {
  waitTitle: string;
  waitSubtitle: string;
  waitStep: string;
  resolvingTitle: string;
  resolvingSubtitle: string;
  replayTitle: string;
  replaySubtitle: string;
  signInTitle: string;
  signInSubtitle: string;
  sealWaitTitle: string;
  sealWaitSubtitle: string;
  failedTitle: string;
  failedSubtitle: string;
  tryAgainCta: string;
  tapRingAgainCta: string;
  holdSteadyLine: string;
  readingCountdownPrefix: string;
  retryCountdownPrefix: string;
  redirectCountdownPrefix: string;
  stillReadingLine: string;
  listeningCountdownPrefix: string;
  linkingCountdownPrefix: string;
  checkingCountdownPrefix: string;
  bindingCountdownPrefix: string;
  listeningStatusLine: string;
  stillListeningLine: string;
  linkingStatusLine: string;
  stillLinkingLine: string;
  checkingStatusLine: string;
  stillCheckingLine: string;
  bindingStatusLine: string;
  stillBindingLine: string;
};

const NFC_HOLD_GUIDE_EN: Record<HavenPlatform, NfcHoldGuideCopy> = {
  ios: {
    waitTitle: "Tap your ring",
    waitSubtitle: "Hold your ring on the top of your iPhone, near the camera.",
    waitStep: "Keep it steady for 3–5 seconds.",
    resolvingTitle: "Reading your ring…",
    resolvingSubtitle: "Keep the ring on the top of your phone. Do not lift yet.",
    replayTitle: "That tap was already used",
    replaySubtitle: "Tap your ring again on the top of your iPhone.",
    signInTitle: "Sign in to continue",
    signInSubtitle: "Use your Apple, Google, or Email account.",
    sealWaitTitle: "Tap your ring to seal",
    sealWaitSubtitle:
      "Hold your ring on the top of your iPhone until sealing finishes.",
    failedTitle: "We could not finish that tap",
    failedSubtitle: "Hold your ring steady on the top of your iPhone, then tap again.",
    tryAgainCta: "Try again",
    tapRingAgainCta: "Tap ring again",
    holdSteadyLine: "Keep holding — this usually takes 3–5 seconds.",
    readingCountdownPrefix: "Keep holding",
    retryCountdownPrefix: "Tap again in",
    redirectCountdownPrefix: "Continuing in",
    stillReadingLine: "Still reading… keep your ring on the phone.",
    listeningCountdownPrefix: "Listening",
    linkingCountdownPrefix: "Linking",
    checkingCountdownPrefix: "Checking",
    bindingCountdownPrefix: "Binding",
    listeningStatusLine: "Listening for your ring…",
    stillListeningLine: "Still listening… keep your ring on the phone.",
    linkingStatusLine: "Linking your ring…",
    stillLinkingLine: "Still linking… this can take a moment.",
    checkingStatusLine: "Checking…",
    stillCheckingLine: "Still checking…",
    bindingStatusLine: "Binding your ring…",
    stillBindingLine: "Still binding…",
  },
  android: {
    waitTitle: "Tap your ring",
    waitSubtitle: "Hold your ring on the back of your phone, near the camera.",
    waitStep: "Keep it steady for 2–4 seconds.",
    resolvingTitle: "Reading your ring…",
    resolvingSubtitle: "Keep the ring on the back of your phone. Do not lift yet.",
    replayTitle: "That tap was already used",
    replaySubtitle: "Tap your ring again on the back of your phone.",
    signInTitle: "Sign in to continue",
    signInSubtitle: "Use your Apple, Google, or Email account.",
    sealWaitTitle: "Tap your ring to seal",
    sealWaitSubtitle: "Hold your ring on the back of your phone until sealing starts.",
    failedTitle: "We could not finish that tap",
    failedSubtitle: "Hold your ring steady on the back of your phone, then tap again.",
    tryAgainCta: "Try again",
    tapRingAgainCta: "Tap ring again",
    holdSteadyLine: "Keep holding — this usually takes 2–4 seconds.",
    readingCountdownPrefix: "Keep holding",
    retryCountdownPrefix: "Tap again in",
    redirectCountdownPrefix: "Continuing in",
    stillReadingLine: "Still reading… keep your ring on the phone.",
    listeningCountdownPrefix: "Listening",
    linkingCountdownPrefix: "Linking",
    checkingCountdownPrefix: "Checking",
    bindingCountdownPrefix: "Binding",
    listeningStatusLine: "Listening for your ring…",
    stillListeningLine: "Still listening… keep your ring on the phone.",
    linkingStatusLine: "Linking your ring…",
    stillLinkingLine: "Still linking… this can take a moment.",
    checkingStatusLine: "Checking…",
    stillCheckingLine: "Still checking…",
    bindingStatusLine: "Binding your ring…",
    stillBindingLine: "Still binding…",
  },
  other: {
    waitTitle: "Tap your ring",
    waitSubtitle: "Hold your ring on the upper back area of your phone.",
    waitStep: "Keep it steady for 3–5 seconds.",
    resolvingTitle: "Reading your ring…",
    resolvingSubtitle: "Keep the ring on your phone. Do not lift yet.",
    replayTitle: "That tap was already used",
    replaySubtitle: "Tap your ring again on the NFC reader area.",
    signInTitle: "Sign in to continue",
    signInSubtitle: "Use your Apple, Google, or Email account.",
    sealWaitTitle: "Tap your ring to seal",
    sealWaitSubtitle: "Hold your ring on your phone until sealing starts.",
    failedTitle: "We could not finish that tap",
    failedSubtitle: "Hold your ring steady, then tap again.",
    tryAgainCta: "Try again",
    tapRingAgainCta: "Tap ring again",
    holdSteadyLine: "Keep holding — this usually takes a few seconds.",
    readingCountdownPrefix: "Keep holding",
    retryCountdownPrefix: "Tap again in",
    redirectCountdownPrefix: "Continuing in",
    stillReadingLine: "Still reading… keep your ring on the phone.",
    listeningCountdownPrefix: "Listening",
    linkingCountdownPrefix: "Linking",
    checkingCountdownPrefix: "Checking",
    bindingCountdownPrefix: "Binding",
    listeningStatusLine: "Listening for your ring…",
    stillListeningLine: "Still listening… keep your ring on the phone.",
    linkingStatusLine: "Linking your ring…",
    stillLinkingLine: "Still linking… this can take a moment.",
    checkingStatusLine: "Checking…",
    stillCheckingLine: "Still checking…",
    bindingStatusLine: "Binding your ring…",
    stillBindingLine: "Still binding…",
  },
};

export function getNfcHoldGuideCopy(platform: HavenPlatform): NfcHoldGuideCopy {
  return NFC_HOLD_GUIDE_EN[platform] ?? NFC_HOLD_GUIDE_EN.other;
}

export const START_PAGE_EN = {
  heroSubtitleFallback: "Tap your ring",
  backToHaven: "Cancel",
  continueWithoutRing: "Cancel",
  keepSealing: "Keep sealing",
  leaveSealWarning: "Cancel sealing?",
  leaveSealConfirmCta: "Cancel",
  retryRingTap: "Tap ring again",
  readingRingStatus: "Reading your ring…",
  preparingMemory: "Sealing your memory...",
  ringVerifyFailedNotice: "We could not finish that tap.",
  footerSecurityReminder: "",
  sealCountdownPrefix: "Time left",
  openingHavenLine: "Open the app to seal a memory.",
  idleRingAck: "Ring recognized. Open the app to seal a memory.",
  openAppCta: "Open App",
  sealWaitTitle: "Tap your ring",
  sealWaitBody: "",
  sealWaitFinishingTitle: "Finishing…",
  sealWaitFinishingBody: "",
  sealWaitBackToEdit: "Back to memory",
  sealWaitSignedInNote: "",
  sealWaitTapHintAndroid: "",
  sealWaitTapHintIos: "",
  sealWaitTapHintOther: "",
} as const;

/** Minimal Seal-with-Ring copy — details live in Help Center. */
export const SEAL_FLOW_EN = {
  readyTitle: "Tap your ring",
  tapPlacementIos: "Near top of phone",
  tapPlacementAndroid: "On back of phone",
  tapPlacementOther: "Near NFC reader",
  readySubtitleIos: "Near top of phone",
  readySubtitleAndroid: "On back of phone",
  readySubtitleOther: "Near NFC reader",
  autoSealHint: "Tap your ring when ready.",
  sealingLabel: "Sealing your memory...",
  sealNotReadyLine: "Open your memory first.",
  successTitle: "Memory sealed",
  successMessage: "Sealed locally — large files still processing…",
  successMessageLarge: "Sealed locally — large files still processing…",
  successViewMemoriesCta: "View Memories",
  successSealAnotherCta: "Seal Another",
  autoSaving: "Saved to Draft Box",
  sealArmFailedCta: "Open",
  sealWaitingStep2: "Tap your ring",
  sealWaitingCountdownPrefix: "Time left",
  sealScanRingCta: "Scan ring on this phone",
  sealScanRingBusy: "Listening for ring…",
  sealCompletedElsewhere: "Memory sealed",
} as const;

export type SealFlowCopyEn = Omit<typeof SEAL_FLOW_EN, "successMessage"> & {
  readySubtitle: string;
  tapPlacement: string;
  successMessage: string;
};

export function getSealFlowCopy(platform: HavenPlatform): SealFlowCopyEn {
  const readySubtitle =
    platform === "ios"
      ? SEAL_FLOW_EN.readySubtitleIos
      : platform === "android"
        ? SEAL_FLOW_EN.readySubtitleAndroid
        : SEAL_FLOW_EN.readySubtitleOther;
  const tapPlacement =
    platform === "ios"
      ? SEAL_FLOW_EN.tapPlacementIos
      : platform === "android"
        ? SEAL_FLOW_EN.tapPlacementAndroid
        : SEAL_FLOW_EN.tapPlacementOther;
  return {
    ...SEAL_FLOW_EN,
    readySubtitle,
    tapPlacement,
    successMessage: wasPostSealLargeMedia()
      ? SEAL_FLOW_EN.successMessageLarge
      : SEAL_FLOW_EN.successMessage,
  };
}

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
        body: "Link a ring to seal with a touch. Sharing is explicit with Plus — see Help.",
        primaryButton: "Bind my first ring",
        secondaryButton: "Start with Face ID only",
      },
    ],
  };
}

/** Pricing / upgrade decision page (EN source of truth). */
export const HAVEN_PRICING_PAGE_EN = {
  pageTitle: "Haven Plus",
  heroTitle: "Your private memory sanctuary",
  heroSubtitle:
    "Seal with Ring and optional encrypted cloud. Each person uses their own account.",
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
    { feature: "Number of rings", free: "Up to 2", plus: "Up to 2 (see Help)" },
    {
      feature: "Seal with Ring",
      free: "Not available on Free",
      plus: "Seal with Ring ritual on your account",
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
    "One 30-day Haven Plus trial per Haven when the first ring is linked — couples share it.",
  footnoteCancel: "Cancel anytime. No questions asked.",
  footnoteBelief:
    "We believe your memories belong to you — not to an ad platform.",
  footnoteCouplePlus:
    "Couples share one Haven Plus. One partner subscribes, both benefit inside the same Haven.",
  ctaTrial: "Start 30-day free trial",
  ctaSubscribe: "Subscribe now",
  payMethodsNote:
    "Checkout may offer Apple Pay, Google Pay, or card depending on your device and region.",
  socialProof:
    "A private memory sanctuary — not a feed. Couples share one Haven Plus. One partner subscribes, both benefit.",
  faqTitle: "FAQ",
  faqs: [
    {
      q: "Do both partners need Haven Plus?",
      a: "No. One Haven Plus covers your whole Pair (up to two accounts). Choose which partner pays; both get Plus benefits in the same Haven.",
    },
    {
      q: "What happens if I cancel?",
      a: "Your local memories stay on this device. Cloud features simply stop renewing — nothing is sold to advertisers.",
    },
    {
      q: "Is my data really private?",
      a: "Local-first with strong encryption on supported flows. Read the Privacy Policy in Settings for cloud and sharing details.",
    },
    {
      q: "Can I use Haven without a ring?",
      a: "Yes. Sign in to read and write. Link a ring only when you want to seal with a touch.",
    },
    {
      q: "Can I edit a sealed memory?",
      a: HAVEN_SEAL_IMMUTABLE_EN,
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
  supplementsHeading: "Notes added after sealing",
  supplementPlaceholder: "Add a short note for your partner…",
  supplementAddCta: "Add note",
  supplementSaved: "Note saved.",
  pairMemoryHint: "Shared in your Pair — core content cannot be edited.",
  partnerMemoryHint: "Sealed by your partner — you can add notes, not edit the core.",
  sharePlusOnly:
    "Share links are not available yet. We are working on safer sharing for a future update.",
  shareSuccess: "Share links are not available yet.",
  topBackLabel: "Back to Memories",
  centerFallbackTitle: "Memory",
  menuOpenAria: "More actions",
  storyHeading: "Story",
  photosHeading: "Photos",
  photoViewFullSize: "View full-size photo",
  photoLightboxClose: "Close",
  photoLightboxLabel: "Full-size photo",
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
  photoViewFullSize: string;
  photoLightboxClose: string;
  photoLightboxLabel: string;
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
  supplementsHeading: string;
  supplementPlaceholder: string;
  supplementAddCta: string;
  supplementSaved: string;
  pairMemoryHint: string;
  partnerMemoryHint: string;
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
    photoViewFullSize: m.photoViewFullSize,
    photoLightboxClose: m.photoLightboxClose,
    photoLightboxLabel: m.photoLightboxLabel,
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
    supplementsHeading: m.supplementsHeading,
    supplementPlaceholder: m.supplementPlaceholder,
    supplementAddCta: m.supplementAddCta,
    supplementSaved: m.supplementSaved,
    pairMemoryHint: m.pairMemoryHint,
    partnerMemoryHint: m.partnerMemoryHint,
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
  sealRitualDetail:
    "To seal a memory: open New Memory, write your story, then tap Seal with Ring. When you see Tap your ring, hold your Haven ring to the NFC spot on your phone (top on iPhone, back on most Android phones) until the seal completes. If sealing does not start, return to New Memory, tap Seal with Ring once, then tap your ring again. Your draft stays on this device until the seal finishes. Haven Plus adds optional encrypted cloud backup — see Settings and Privacy Policy.",
  categoryPrivacyTitle: "Privacy & Security",
  categoryPrivacySubtitle: "What stays on-device, exports, and high-risk actions.",
  categoryBillingTitle: "Subscription & Billing",
  categoryBillingSubtitle: "Plus, trial, and cancellation in plain language.",
  categoryBillingBody:
    "Couples share one Haven Plus — one partner subscribes, both benefit inside the same Haven. Solo users choose Plus on their own account. Cancel anytime.",
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
    idleRingTap: HAVEN_START_IDLE_RING_TAP,
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
