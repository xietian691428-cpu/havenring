export const BIND_RING_PAGE_EN = {
  kicker: "",
  title: "Link your ring",
  body: "Hold your ring near your phone.",
  joinPromptTemplate:
    "Join {name}'s Haven to share sealed memories with them?",
  joinTapRingHint: "Hold your ring near your phone once.",
  syncing: "Syncing…",
  joinCta: "Join",
  joinCtaSetup: "Create password & join",
  cancelCta: "Cancel",
  openSharedMemoriesCta: "Open shared memories",
  openHavenCta: "Open Haven",
  inviteExpired: "This link expired — ask for a new one.",
  inviteComplete: "You're already linked.",
  statusOtherAccount: "This ring belongs to another account.",
  statusRetired: "This ring cannot be used again.",
  statusYours: "This ring is already on your account.",
  signInFailed: "Sign-in could not start.",
  signInRequired: "Sign in to continue.",
  bindFailed: "Could not join. Try again.",
  inviteKeyMissing: "Ask your partner for a fresh link.",
  alreadyBound: "This ring is already linked.",
  statusUnlinked: "Ready to link",
  statusCheckFailed: "Could not check ring status",
  openingSignIn: "Opening…",
  signInApple: "Sign in with Apple",
  signInGoogle: "Sign in with Google",
  nicknameLabel: "Ring name",
  devicePasswordLabel: "Device password",
  devicePasswordCreateLabel: "Create a device password",
  devicePasswordConfirmLabel: "Confirm password",
  recoveryCodeLabel: "Recovery code",
  recoveryOptional: "If you forgot your password",
  passwordTooShort: "Password must be at least 6 characters.",
  passwordMismatch: "Passwords do not match.",
  passwordVerifyFailed: "Wrong password. Try again or use your recovery code.",
  securitySetupFailed: "Could not create your device password.",
  recoveryTitle: "Save your recovery code",
  recoveryHint: "Store this somewhere safe.",
  binding: "Joining…",
  linkRingCta: "Link ring",
  linkRingCtaSetup: "Create password & link ring",
  joinErrorSeparateAccount: "Use your own Apple or Google account.",
  joinErrorGeneric: "Could not join — try again or ask for a new link.",
} as const;

export function formatJoinPrompt(inviterName: string): string {
  const name = String(inviterName || "").trim() || "your partner";
  return BIND_RING_PAGE_EN.joinPromptTemplate.replace("{name}", name);
}

/** @deprecated use formatJoinPrompt */
export function formatJoinTitle(inviterName: string): string {
  return formatJoinPrompt(inviterName);
}
