export const STORAGE_KEYS = {
  deferredAppEntry: "haven.deferredAppEntry.v1",
  ftuxStarted: "haven.ftux.started.v1",
  onboardingCompleted: "haven.onboarding.completed.v1",
  onboardingOutcome: "haven.onboarding.outcome.v1",
  firstMemoryCompleted: "haven.first_memory.completed.v1",
  timelineTrySealHintDismissed: "haven.timeline.trySealHintDismissed.v1",
  ringRegistry: "haven.ring.registry.v1",
  activeRingUidKey: "haven.ring.active.uidKey.v1",
  ringSetupDismissed: "haven.ring.setup.dismissed.v1",
  ringSetupInstallSuppress: "haven.install.confirm.suppress.v1",
  ringSetupPendingScan: "haven.ring.setup.pending_scan.v1",
  ringSetupPendingScanCompat: "pendingNfcScan",
  securityProfile: "haven.security.profile.v1",
  deviceId: "haven.device.id.v1",
  keepSignedIn: "haven.auth.keepSignedIn.v1",
  ringAccessGrantPrefix: "haven.ring.access.grant.",
  sealArmed: "haven.seal.armed.v1",
  pendingSealDraftIds: "haven.pending_seal_draft_ids.v1",
  composerSnapshot: "haven.new_memory_draft",
  /** Set before reload when composer hits memory pressure (session-scoped). */
  composerMemoryStress: "haven.composer.memory_stress.v1",
  /** Last save failed due to memory pressure (session-scoped). */
  lastSaveOom: "haven.composer.last_save_oom.v1",
  /** Cached memory count for iOS OOM heuristics (session-scoped). */
  oomRiskSnapshot: "haven.ios.oom_risk_snapshot.v1",
  /** Post-seal Timeline quiet window (session-scoped). */
  postSealQuiet: "haven.seal.post_quiet.v1",
  /** Local IDB quota warning shown once per session. */
  localStorageQuotaWarn: "haven.local_storage.quota_warn.v1",
  /** Last timeline list refresh (session-scoped cooldown). */
  timelineLastRefresh: "haven.timeline.last_refresh.v1",
  /** One automatic background sync per app session (iOS boot). */
  timelineBootSync: "haven.timeline.boot_sync.v1",
  sealNfcTapRelay: "haven.seal.last_nfc_tap.v1",
  sealResolveLock: "haven.seal.resolve.lock.v1",
  sealCompleteRelay: "haven.seal.complete.v1",
  sealWaitTabActive: "haven.seal.wait_tab.v1",
  /** @deprecated Prefer sealPrepBundle; kept for cross-tab read fallback. */
  sealDraftRelay: "haven.seal.draft.relay.v1",
  /** Pending draft ids + relay payloads (consolidated cross-tab prep). */
  sealPrepBundle: "haven.seal.prep.v2",
  sealStepUpRequired: "haven.seal.step_up_required.v1",
  sealPwaHintDismissed: "haven.seal.pwa_hint.dismissed.v1",
  /** Pair share opt-in (default on after bind). "1" = share sealed memories in Pair. */
  pairShareEnabled: "haven.pair.share_enabled.v1",
  pairSharePromptDone: "haven.pair.share_prompt_done.v1",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
