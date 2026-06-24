/**
 * Smoke checks for Auth / NFC intent / Seal URL contracts after refactors.
 * Run: npx tsx scripts/verify-flow-contracts.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasSdmSearch, readNfcIntent } from "../lib/nfc-intent";
import {
  isPrimarySealWaitPage,
  isRingTapSealLandingPage,
  isSealWaitSearch,
} from "../src/features/seal/sealNavigate";
import { STORAGE_KEYS } from "../lib/storage-keys";
import { SEAL_ARMED_KEY } from "../lib/seal-flow";
import { PENDING_SEAL_DRAFT_IDS_KEY } from "../src/features/seal/sealTypes";
import { COMPOSER_SNAPSHOT_KEY } from "../src/features/seal/composerSnapshotSafe";
import {
  clearSealNfcTapHref,
  consumeFreshSealNfcTapHref,
} from "../src/features/seal/sealNfcTapRelay";
import {
  FREE_RING_LIMIT,
  PLUS_RING_LIMIT,
} from "../src/features/subscription/subscriptionTypes";
import { MAX_RING_QUANTITY } from "../lib/shop/catalog";
import { MAX_BOUND_RINGS } from "../src/services/ringRegistryService";
import { mergeSupplements } from "../lib/memory-supplements";

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✗ ${label}`);
    throw error;
  }
}

function readRepoFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

check("SDM picc_data + cmac detected", () => {
  const q = "?picc_data=ABC&cmac=DEF";
  assert.equal(hasSdmSearch(q), true);
  assert.equal(readNfcIntent(q), "daily");
});

check("seal wait URL intent=seal", () => {
  const q = "?seal_wait=1&intent=seal";
  assert.equal(isSealWaitSearch(q), true);
  assert.equal(readNfcIntent(q), "seal");
});

check("seal navigate helpers exported", () => {
  assert.equal(typeof isPrimarySealWaitPage, "function");
  assert.equal(typeof isRingTapSealLandingPage, "function");
  assert.equal(typeof consumeFreshSealNfcTapHref, "function");
  assert.equal(typeof clearSealNfcTapHref, "function");
});

check("claim param maps to claim intent", () => {
  const q = "?claim=token123";
  assert.equal(readNfcIntent(q), "claim");
});

check("explicit bind intent", () => {
  const q = "?intent=bind&uid=0442A53A502390";
  assert.equal(readNfcIntent(q), "bind");
});

check("idle start with no params", () => {
  assert.equal(readNfcIntent(""), "idle");
  assert.equal(hasSdmSearch(""), false);
});

check("storage keys aligned for seal flow", () => {
  assert.equal(SEAL_ARMED_KEY, STORAGE_KEYS.sealArmed);
  assert.equal(PENDING_SEAL_DRAFT_IDS_KEY, STORAGE_KEYS.pendingSealDraftIds);
  assert.equal(COMPOSER_SNAPSHOT_KEY, STORAGE_KEYS.composerSnapshot);
  assert.equal(typeof STORAGE_KEYS.sealWaitTabActive, "string");
  assert.equal(STORAGE_KEYS.sealDraftRelay, "haven.seal.draft.relay.v1");
  assert.equal(STORAGE_KEYS.sealStepUpRequired, "haven.seal.step_up_required.v1");
});

check("seal prep has cross-tab persistence keys", () => {
  assert.equal(STORAGE_KEYS.sealArmed, "haven.seal.armed.v1");
  assert.equal(STORAGE_KEYS.pendingSealDraftIds, "haven.pending_seal_draft_ids.v1");
});

check("ring pair limit is 2 everywhere (not legacy 5-ring family)", () => {
  assert.equal(FREE_RING_LIMIT, 2);
  assert.equal(PLUS_RING_LIMIT, 2);
  assert.equal(MAX_RING_QUANTITY, 2);
  assert.equal(MAX_BOUND_RINGS, 2);
});

check("dual-account Haven requires invite for second ring", () => {
  const bindRoute = readRepoFile("app/api/nfc/bind/route.ts");
  assert.match(bindRoute, /invite_code/);
  assert.match(bindRoute, /INVITE_REQUIRES_SEPARATE_ACCOUNT/);
  assert.match(bindRoute, /Each account can link one active ring/);
});

check("ring-only login cannot bootstrap partner account", () => {
  const nfcLogin = readRepoFile("app/api/auth/nfc-login/route.ts");
  assert.match(nfcLogin, /nfc_login_disabled_for_shared_haven/);
  assert.doesNotMatch(nfcLogin, /signSupabaseAccessJwt/);
});

check("dual-account migration enforces Haven membership and non-transferability", () => {
  const migration = readRepoFile("supabase/migrations/0017_dual_account_haven_pair.sql");
  assert.match(migration, /user_nfc_rings_haven_user_active_uniq/);
  assert.match(migration, /haven_ring_limit_reached/);
  assert.match(migration, /ring_binding_is_non_transferable/);
  assert.match(migration, /issue_partner_invite/);
  assert.match(migration, /interval '24 hours'/);
  assert.match(migration, /haven_member_keys/);
  assert.match(migration, /legacy_single_account_extra_ring/);
});

check("invite revoke and shared key flows are wired", () => {
  const inviteRoute = readRepoFile("app/api/haven/invite/route.ts");
  const inviteDelivery = readRepoFile("app/api/haven/invite/delivery/route.ts");
  const inviteKey = readRepoFile("app/api/haven/invite/key/route.ts");
  const inviteStatus = readRepoFile("app/api/haven/invite/status/route.ts");
  const bindClient = readRepoFile("app/bind-ring/bind-ring-client.tsx");
  const ringsPage = readRepoFile("src/views/RingsPage.js");
  const invitePanel = readRepoFile("src/components/PartnerInvitePanel.js");
  const keyService = readRepoFile("src/services/havenKeyService.js");
  const shareInvite = readRepoFile("lib/shareInviteLink.ts");
  assert.match(inviteRoute, /24 \* 60 \* 60 \* 1000/);
  assert.match(inviteRoute, /export async function DELETE/);
  assert.match(inviteDelivery, /key_package/);
  assert.match(inviteKey, /keyPackage/);
  assert.match(inviteStatus, /partnerJoined/);
  assert.match(ringsPage, /PartnerInvitePanel/);
  assert.match(invitePanel, /inviteShareCta/);
  assert.match(readRepoFile("src/content/ringsPageContent.js"), /Add Partner/);
  assert.match(readRepoFile("lib/nfc-entry-orchestrator.ts"), /\/api\/haven\/invite\/key/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /resolvedUid/);
  assert.match(readRepoFile("lib/partner-invite-pending.ts"), /buildBindRingUrl/);
  const sealNavigate = readRepoFile("src/features/seal/sealNavigate.ts");
  assert.match(sealNavigate, /isSealWaitTabActive\(\)\) return false/);
  assert.match(readRepoFile("src/features/seal/sealFlowClient.ts"), /syncHydrateSealPrepFromStorage/);
  assert.match(readRepoFile("src/features/seal/sealCrossTab.ts"), /tryAcquireSealResolveLockForSealTap/);
  assert.match(readRepoFile("src/features/seal/sealCrossTab.ts"), /forceClearSealResolveLock/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /document\.visibilityState === "hidden"/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /sdmResolveWatchdogMs/);
  assert.match(readRepoFile("lib/nfc-flow-timing.ts"), /withTimeout/);
  assert.match(bindClient, /initializeSecurity/);
  assert.match(bindClient, /joinWithExistingRing/);
  assert.match(readRepoFile("src/content/bindRingPageContent.ts"), /joinCta/);
  assert.match(bindClient, /importHavenKeyFromInvitePackage/);
  assert.match(bindClient, /uploadWrappedHavenKey/);
  assert.match(keyService, /RSA-OAEP/);
  assert.match(shareInvite, /navigator\.share/);
});

check("start page: seal + bind only; daily_access is ack not unlock", () => {
  const resolveRoute = readRepoFile("app/api/rings/sdm/resolve/route.ts");
  const startClient = readRepoFile("app/start/StartClient.tsx");
  const timing = readRepoFile("lib/nfc-flow-timing.ts");
  assert.match(resolveRoute, /currentUserIsHavenMember/);
  assert.match(resolveRoute, /daily_access/);
  assert.match(startClient, /minimalNfcCopy/);
  assert.match(startClient, /idleRingAck/);
  assert.match(startClient, /getNfcHoldGuideCopy/);
  assert.match(startClient, /NfcHoldGuide/);
  assert.match(startClient, /finalizeSealChainFromSdmResponseSafe/);
  assert.doesNotMatch(startClient, /enterRingWaitMode/);
  assert.doesNotMatch(startClient, /signInForRingAccess/);
  assert.doesNotMatch(startClient, /isDailyMember/);
  assert.doesNotMatch(startClient, /successRedirectMs/);
  assert.match(readRepoFile("src/hooks/useActionStepCountdown.js"), /useDeadlineCountdown/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /IndeterminateStepStatus/);
  assert.match(readRepoFile("src/views/TimelinePage.js"), /syncIssueOffline/);
  assert.match(readRepoFile("lib/sync-failure.ts"), /classifySyncFailure/);
  assert.doesNotMatch(readRepoFile("src/views/TimelinePage.js"), /syncRetryCountdown/);
  assert.doesNotMatch(readRepoFile("app/bind-ring/bind-ring-client.tsx"), /ActionStepCountdown/);
  assert.match(readRepoFile("src/components/IndeterminateStepStatus.tsx"), /IndeterminateStepStatus/);
  assert.match(startClient, /readingCountdownPrefix/);
  assert.match(startClient, /tapRingAgainCta/);
  assert.match(startClient, /postSdmResolveWithRetry/);
  assert.doesNotMatch(startClient, /failedRetryReady/);
  assert.doesNotMatch(startClient, /retryCountdownPrefix/);
  assert.match(timing, /minFailedBeforeRetryMs/);
  assert.doesNotMatch(startClient, /window\.location\.reload\(\)/);
});

check("Haven-level Plus billing", () => {
  const havenPlus = readRepoFile("lib/haven-plus.ts");
  const migration = readRepoFile("supabase/migrations/0023_haven_plus_billing.sql");
  const billingRoute = readRepoFile("app/api/haven/plus-billing/route.ts");
  const subStatus = readRepoFile("app/api/subscription/status/route.ts");
  assert.match(havenPlus, /resolvePlusForHaven/);
  assert.match(havenPlus, /activatePlusTrialForHaven/);
  assert.match(migration, /plus_billing_user_id/);
  assert.match(migration, /plus_trial_end/);
  assert.match(billingRoute, /setHavenPlusBillingUser/);
  assert.match(subStatus, /havenPlus/);
  assert.match(readRepoFile("src/content/havenCopy.ts"), /Couples share one Haven Plus/);
});

check("ring bind is optional not gated", () => {
  const machine = readRepoFile("src/state/appFlowMachine.js");
  const router = readRepoFile("src/app-shell/AppRouter.tsx");
  const wizard = readRepoFile("src/components/RingSetupWizard.js");
  assert.doesNotMatch(machine, /RING_SETUP_GATE/);
  assert.match(router, /\/bind-ring/);
  assert.doesNotMatch(router, /RingSetupWizard/);
  assert.match(wizard, /\/bind-ring/);
  assert.match(readRepoFile("src/content/havenCopy.ts"), /You're all set/);
});

check("pair model: haven-scoped sync and owner-only seal", () => {
  const access = readRepoFile("lib/haven-access.ts");
  const membership = readRepoFile("lib/haven-membership.ts");
  const syncMoments = readRepoFile("app/api/sync/moments/route.ts");
  const pairBundles = readRepoFile("app/api/sync/pair-bundles/route.ts");
  const pairSync = readRepoFile("src/services/pairSharingService.js");
  const sdmResolve = readRepoFile("app/api/rings/sdm/resolve/route.ts");
  const ringTap = readRepoFile("app/api/seal/ring-tap/route.ts");
  const ringsPage = readRepoFile("src/views/RingsPage.js");
  const ringsContent = readRepoFile("src/content/ringsPageContent.js");
  const bindClient = readRepoFile("app/bind-ring/bind-ring-client.tsx");
  const coreDef = readRepoFile("docs/core-definition.md");
  assert.match(access, /userCanSealWithRing/);
  assert.match(access, /userCanReadPairMoments/);
  assert.match(membership, /owner-only/);
  assert.match(syncMoments, /resolveHavenPairScope/);
  assert.match(syncMoments, /pair_shared_sealed/);
  assert.match(pairBundles, /pair-bundles/);
  assert.match(pairBundles, /\.from\("moments"\)/);
  assert.doesNotMatch(pairBundles, /pair_bundles/);
  assert.match(readRepoFile("supabase/migrations/0025_pair_sync_moments_hardening.sql"), /moments_haven_sealed_created_idx/);
  assert.match(pairSync, /syncPairMemoriesFromServer/);
  assert.match(pairSync, /normalizePhotosForStorage/);
  assert.match(pairSync, /photosUpgraded/);
  assert.match(readRepoFile("lib/pair-sharing.ts"), /TextDecoder/);
  assert.match(sdmResolve, /RING_OWNER_REQUIRED/);
  assert.match(ringTap, /RING_OWNER_REQUIRED/);
  assert.match(ringsPage, /serverPairActive/);
  assert.match(ringsPage, /resolvePairState/);
  assert.match(ringsPage, /syncPending/);
  assert.match(ringsPage, /linkWithPartnerCta/);
  assert.match(ringsPage, /canLinkPartner/);
  assert.match(readRepoFile("lib/pair-state-resolver.ts"), /pruneStaleLocalRingsFromCloud/);
  assert.match(readRepoFile("lib/nfc-entry-orchestrator.ts"), /runNfcEntryOrchestrator/);
  assert.match(readRepoFile("lib/join-pair-haven.ts"), /tryIdempotentPairJoin/);
  assert.match(readRepoFile("src/services/ringSyncService.js"), /pruneStaleLocalRingsFromCloud/);
  assert.match(readRepoFile("src/state/appFlowSelectors.js"), /reconcilePairStateOnAppLifecycle/);
  assert.match(ringsContent, /pairActiveBanner/);
  assert.match(ringsContent, /linkedWithPartnerStatus/);
  assert.match(ringsContent, /syncingRings/);
  assert.match(readRepoFile("app/api/nfc/list/route.ts"), /ringListHavenIds/);
  assert.match(readRepoFile("app/api/haven/invite/preview/route.ts"), /inviterName/);
  assert.match(bindClient, /formatJoinPrompt/);
  assert.match(bindClient, /resolveInvitePhase/);
  assert.match(readRepoFile("lib/join-pair-haven.ts"), /joinExistingRingToInviteHaven/);
  assert.match(readRepoFile("src/services/ringRegistryService.js"), /pruneStaleLocalRingsFromCloud/);
  assert.match(readRepoFile("app/api/nfc/bind/route.ts"), /joinExistingRingToInviteHaven/);
  assert.match(readRepoFile("docs/core-definition.md"), /Pair join — foolproof UX/);
  assert.match(readRepoFile("lib/user-facing-errors.ts"), /userFacingBindError/);
  assert.match(readRepoFile("lib/nfc-sdm-resolve-client.ts"), /postSdmResolveWithRetry/);
  assert.match(readRepoFile("lib/nfc-entry-orchestrator.ts"), /ensureInviteKeyPackageAuto/);
  assert.match(bindClient, /ensureInviteKeyPackageAuto/);
  assert.match(bindClient, /buildStartBindInviteHref/);
  assert.match(readRepoFile("app/start/StartPageClient.tsx"), /nextDynamic/);
  assert.match(readRepoFile("lib/entry-defer.ts"), /deferEntryWork/);
  assert.match(readRepoFile("src/app-shell/AppShell.tsx"), /DeferredAppProviders/);
  assert.match(readRepoFile("src/app-shell/AppShell.tsx"), /recordIosPageReload/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /StartPageSkeleton/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /shouldRunIosBackgroundSync/);
  assert.match(readRepoFile("src/components/SaveToHavenDialog.js"), /onClose/);
  assert.match(readRepoFile("lib/composer-photo-utils.ts"), /composerPhotosForDraft/);
  assert.match(readRepoFile("lib/app-entry-nav.ts"), /buildAppEntryHref/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /useRouter/);
  assert.match(readRepoFile("app/start/StartClient.tsx"), /router\.(push|replace)/);
  assert.doesNotMatch(
    readRepoFile("app/start/StartClient.tsx"),
    /window\.location\.(replace|assign)\("\/app/
  );
  assert.doesNotMatch(readRepoFile("lib/ios-app-boot.ts"), /IOS_FROM_START_EXTRA_MS/);
  assert.match(readRepoFile("src/providers/MemoriesProvider.tsx"), /timelineLifecycleActive/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /MemoriesProvider/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /useMemoriesContext/);
  assert.doesNotMatch(readRepoFile("src/app-shell/AppRouter.tsx"), /useMemories\(/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /queueBackgroundSync\("session"\)/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /shouldAllowTimelinePullRefresh/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /shouldAllowIosTimelineThumbs/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /markIosTimelineScrolled/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /deferIosPostBootWork/);
  assert.match(readRepoFile("lib/ios-reload-guard.ts"), /isIosReloadMinimalMode/);
  assert.match(
    readRepoFile("src/app-shell/AppRouter.tsx"),
    /handleTimelinePullRefresh = useCallback\(async \(\) => \{[\s\S]*?await syncLightNow\(\)/
  );
  assert.match(readRepoFile("src/services/ringSyncService.js"), /shouldImportPairMemories/);
  assert.match(readRepoFile("public/sw.js"), /haven-shell-v13/);
  assert.match(readRepoFile("public/sw.js"), /skipWaiting/);
  assert.match(readRepoFile("app/layout.tsx"), /fonts-inter/);
  assert.match(readRepoFile("app/layout.tsx"), /ios-font-minimal/);
  assert.doesNotMatch(readRepoFile("app/layout.tsx"), /from "next\/font\/google"[\s\S]*Geist/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /MemoryDetailPage = dynamic/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /SettingsPage = dynamic/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /ExplorePage = dynamic/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /refreshInFlightRef/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /wasSealRecentlyCompleted/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /syncInFlightRef/);
  assert.match(
    readRepoFile("src/app-shell/AppRouter.tsx"),
    /onTabTimeline: \(\) => \{[\s\S]*?navigateTo\(\{ name: "timeline"[\s\S]*?void refresh\(\)/
  );
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /tabTimelineBusyRef/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /autoSyncQueuedRef/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /queueBackgroundSync/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /IOS_PULL_REFRESH_MIN_BOOT_MS = 20_000/);
  assert.match(readRepoFile("lib/memory-photo-types.ts"), /PhotoBlobType/);
  assert.match(readRepoFile("lib/photo-blob-store.ts"), /STORE_PHOTO_BLOBS/);
  assert.match(readRepoFile("lib/memory-db.ts"), /MEMORY_DB_VERSION = 4/);
  assert.match(readRepoFile("lib/memory-db.ts"), /STORE_MEMORY_SUPPLEMENTS/);
  assert.match(readRepoFile("lib/memory-supplements.ts"), /mergeSupplements/);
  assert.match(readRepoFile("lib/memory-supplements-store.ts"), /writeSupplementsForMemory/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /mergeSupplements/);
  assert.match(readRepoFile("src/services/pairSharingService.js"), /mergeSupplements/);
  assert.match(readRepoFile("lib/composer-photo-utils.ts"), /PreparedComposerPhoto/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /getMemoryPhotoBlob/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /persistPhotoInputs/);
  assert.match(readRepoFile("lib/photo-blob-migration.ts"), /scheduleLegacyPhotoBlobMigration/);
  assert.match(readRepoFile("src/hooks/useMemoryPhotoDisplayUrl.js"), /getMemoryPhotoBlob/);
  assert.doesNotMatch(
    readRepoFile("lib/composer-photo-utils.ts"),
    /prepareComposerPhotosForSave[\s\S]*?dataUrl: string/
  );
  assert.match(readRepoFile("lib/timeline-memory-preview.ts"), /memoryPayloadToTimelinePreview/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /memoryPayloadToTimelinePreview/);
  assert.doesNotMatch(
    readRepoFile("src/hooks/useMemories.js"),
    /createMemory\(enrichedPayload\);\s*\n\s*const created = await getMemoryById/
  );
  assert.doesNotMatch(readRepoFile("src/views/NewMemoryPage.js"), /prepareComposerPhotosForSave\([^)]+,/);
  assert.match(readRepoFile("lib/composer-platform-limits.ts"), /getComposerSaveLimits/);
  assert.match(readRepoFile("src/features/seal/sealMediaPrep.ts"), /resolveComposerMediaRowForSeal/);
  assert.match(readRepoFile("lib/composer-platform-limits.ts"), /maxPhotos: 8/);
  assert.match(readRepoFile("lib/workers/imageCompressor.worker.ts"), /OffscreenCanvas/);
  assert.match(readRepoFile("lib/image-compressor-client.ts"), /compressImageFile/);
  assert.match(readRepoFile("lib/composer-memory-guard.ts"), /readMemoryPressure/);
  assert.match(readRepoFile("src/components/ComposerMemoryRecovery.tsx"), /Keep editing/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /compressImageFile/);
  assert.match(readRepoFile("src/views/TimelinePage.js"), /useVirtualizer/);
  assert.match(readRepoFile("src/services/lightSyncService.js"), /runLightManifestSync/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /syncLightNow/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /syncDeepNow/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /getTimelineMemorySummaries/);
  assert.match(readRepoFile("lib/timeline-thumb-cache.ts"), /revokeObjectURL/);
  assert.match(readRepoFile("lib/timeline-thumb-store.ts"), /writePersistedTimelineMedia/);
  assert.match(readRepoFile("lib/timeline-thumb-store.ts"), /mediumBlob/);
  assert.match(readRepoFile("lib/timeline-thumb-cache.ts"), /readPersistedTimelineMedia/);
  assert.match(readRepoFile("lib/timeline-decode-queue.ts"), /runTimelineDecodeTask/);
  assert.match(readRepoFile("lib/timeline-media-decode.ts"), /dataUrlToTimelineMediaBlobs/);
  assert.match(readRepoFile("lib/timeline-image-worker-client.ts"), /resizeImageDataUrlInWorker/);
  assert.match(readRepoFile("lib/ios-memory-heuristics.ts"), /estimateOomRisk/);
  assert.match(readRepoFile("lib/ios-memory-heuristics.ts"), /shouldBlockSaveForOomRisk/);
  assert.match(readRepoFile("lib/ios-memory-heuristics.ts"), /shouldDisableTimelineThumbsForOomRisk/);
  assert.match(readRepoFile("lib/ios-app-boot.ts"), /getOomRiskSyncDelayMs/);
  assert.match(readRepoFile("lib/composer-memory-guard.ts"), /readComposerMemoryPressure/);
  assert.match(readRepoFile("lib/composer-memory-guard.ts"), /shouldBlockComposerSave/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /shouldBlockComposerSave/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /readComposerMemoryPressure/);
  assert.doesNotMatch(readRepoFile("src/views/NewMemoryPage.js"), /shouldBlockSaveForOomRisk/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /markLastSaveOom/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /getMemoryCount/);
  assert.match(readRepoFile("lib/timeline-memory-guard.ts"), /shouldUseTextFirstTimeline/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /getTimelineMemoryThumbBlob/);
  assert.match(readRepoFile("src/features/memories/localMemoryStore.ts"), /story: ""/);
  assert.match(readRepoFile("src/hooks/useTimelineThumbUrls.js"), /textFirst/);
  assert.match(readRepoFile("src/hooks/useTimelineMemoryMode.js"), /useTimelineMemoryMode/);
  assert.match(readRepoFile("src/hooks/usePullToRefresh.js"), /getTimelinePullRefreshCooldownMs/);
  assert.match(readRepoFile("lib/timeline-ios-guard.ts"), /getTimelinePageSize\(\): number \{\n  if \(isIosWebKit\(\)\) return 6;/);
  assert.match(readRepoFile("lib/timeline-ios-guard.ts"), /getTimelineThumbMaxDim\(\): number \{\n  return isMobileMemorySensitive\(\) \? 300 : 320;/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /estimateComposerSealSizeLight/);
  assert.match(readRepoFile("src/app-shell/AppRouter.tsx"), /dynamic\(/);
  assert.match(readRepoFile("src/services/offlineSyncQueue.ts"), /flushOfflineSyncQueue/);
  assert.match(readRepoFile("src/services/offlineSyncQueue.ts"), /enqueueSealFinalize/);
  assert.match(readRepoFile("src/features/seal/sealFinalizeSafe.ts"), /enqueueSealFinalize/);
  assert.match(readRepoFile("docs/core-definition.md"), /Background fault tolerance/);
  assert.match(readRepoFile("src/state/recoveryPolicy.js"), /severity: "soft", reason: "hash_mismatch"/);
  assert.doesNotMatch(readRepoFile("src/views/TimelinePage.js"), /onClick=\{\(\) => void onResyncNow/);
});

check("cloud backup 50GB quota compress and chunk upload", () => {
  const config = readRepoFile("lib/cloud-storage-config.ts");
  const server = readRepoFile("lib/cloud-storage-server.ts");
  const backup = readRepoFile("src/services/cloudBackupService.js");
  const quotaRoute = readRepoFile("app/api/cloud-backup/quota/route.ts");
  const uploadRoute = readRepoFile("app/api/cloud-backup/upload/route.ts");
  const latestRoute = readRepoFile("app/api/cloud-backup/latest/route.ts");
  const migration = readRepoFile("supabase/migrations/0026_cloud_memory_backups.sql");
  assert.match(config, /CLOUD_STORAGE_QUOTA_BYTES/);
  assert.match(config, /CLOUD_STORAGE_QUOTA_GB = PLUS_STORAGE_GB/);
  assert.match(config, /CLOUD_STORAGE_FULL_MESSAGE/);
  assert.match(server, /assertCloudQuotaHeadroom/);
  assert.match(server, /cloud_memory_backups/);
  assert.match(server, /listLatestCloudMemoryBackups/);
  assert.match(backup, /encryptCloudBackupPlaintext/);
  assert.match(backup, /restoreFromCloud/);
  assert.match(readRepoFile("lib/photo-blob-migration.ts"), /getAllKeys/);
  assert.match(readRepoFile("lib/timeline-memory-guard.ts"), /isIosAppBootQuiet/);
  assert.match(readRepoFile("src/services/cloudBackupService.js"), /IOS_RESTORE_BATCH_SIZE = 1/);
  assert.match(readRepoFile("src/services/cloudBackupService.js"), /restoreFromCloudDeep/);
  assert.match(readRepoFile("src/services/cloudBackupService.js"), /peekCloudBackupManifest/);
  assert.match(readRepoFile("src/views/SettingsPage.js"), /handleDeepSync/);
  assert.match(backup, /backupMemoryToCloud/);
  assert.match(quotaRoute, /CLOUD_STORAGE_FULL/);
  assert.match(uploadRoute, /mode === "commit"/);
  assert.match(uploadRoute, /memory_id/);
  assert.match(latestRoute, /listLatestCloudMemoryBackups/);
  assert.match(migration, /cloud_memory_backups/);
  assert.match(readRepoFile("lib/cloud-backup-merge.ts"), /applyCloudMemoryToLocal/);
  assert.match(readRepoFile("src/hooks/useMemories.js"), /restoreCloudBackupsQuietly/);
});

check("timeline sync does not fail when optional cloud backup is off", () => {
  const sync = readRepoFile("src/services/ringSyncService.js");
  const backup = readRepoFile("src/services/cloudBackupService.js");
  assert.match(backup, /isCloudBackupReady/);
  assert.match(sync, /isCloudBackupReady/);
  assert.match(sync, /if \(!cloudBackupReady\)/);
  assert.match(sync, /clearRingSyncQueue/);
  assert.match(sync, /isCriticalSyncIssue/);
  assert.match(sync, /ring-scoped cache sync skipped/);
  assert.match(readRepoFile("src/services/ringScopedCacheService.js"), /haven-ring-scoped-cache-v2/);
  assert.match(readRepoFile("src/services/ringScopedCacheService.js"), /scopedKey/);
  assert.match(readRepoFile("src/features/memories/draftBoxStore.ts"), /haven-draft-box-v2/);
  assert.match(sync, /\/api\/sync\/moments/);
  assert.match(readRepoFile("app/api/sync/moments/route.ts"), /requireAuthenticatedUser/);
});

check("seal phase 2: PWA hint + BroadcastChannel cross-tab", () => {
  const broadcast = readRepoFile("src/features/seal/sealBroadcast.ts");
  const sealPlatform = readRepoFile("src/features/seal/sealPlatform.ts");
  assert.match(broadcast, /BroadcastChannel/);
  assert.match(broadcast, /isEphemeralStorageEnvironment/);
  assert.match(readRepoFile("src/components/SealPwaHintCard.js"), /SEAL_PWA_HINT/);
  assert.match(readRepoFile("src/features/seal/sealCrossTab.ts"), /postSealBroadcast/);
  assert.match(readRepoFile("src/features/seal/sealNfcTapRelay.ts"), /postSealBroadcast/);
  assert.match(sealPlatform, /isStandaloneDisplayMode/);
  assert.equal(STORAGE_KEYS.sealPwaHintDismissed, "haven.seal.pwa_hint.dismissed.v1");
});

check("seal staging API and encrypted cross-tab handoff", () => {
  const stagingRoute = readRepoFile("app/api/seal/staging/route.ts");
  const stagingIdRoute = readRepoFile("app/api/seal/staging/[id]/route.ts");
  const stagingCrypto = readRepoFile("src/features/seal/sealStagingCrypto.ts");
  const sealFlow = readRepoFile("src/features/seal/sealFlowClient.ts");
  const sealPlatform = readRepoFile("src/features/seal/sealPlatform.ts");
  const migration = readRepoFile("supabase/migrations/0019_seal_staging.sql");
  const privacy = readRepoFile("app/privacy-policy/privacyPolicyContent.ts");
  assert.match(migration, /seal_staging/);
  assert.match(migration, /staging_id/);
  assert.match(stagingRoute, /ciphertext/);
  assert.match(stagingCrypto, /AES-GCM/);
  assert.match(stagingCrypto, /HKDF/);
  assert.match(sealFlow, /prepareSealForRingTap/);
  assert.match(sealFlow, /uploadSealStaging/);
  assert.match(sealFlow, /fetchSealStagingPayloads/);
  assert.match(sealPlatform, /platform === "ios"/);
  assert.match(readRepoFile("app/api/seal/finalize/route.ts"), /consumeSealStagingById/);
  assert.match(readRepoFile("app/api/rings/sdm/resolve/route.ts"), /staging_id/);
  assert.match(privacy, /10 minutes/);
  assert.doesNotMatch(readRepoFile("src/content/havenCopy.ts"), /Avoid Safari Private/);
});

check("seal staging phase 3: storage split, cron purge, strategy + limits", () => {
  const config = readRepoFile("lib/seal-staging-config.ts");
  const stagingRoute = readRepoFile("app/api/seal/staging/route.ts");
  const server = readRepoFile("lib/seal-staging-server.ts");
  const migration = readRepoFile("supabase/migrations/0020_seal_staging_storage.sql");
  const cronRoute = readRepoFile("app/api/cron/purge-seal-staging/route.ts");
  const vercel = readRepoFile("vercel.json");
  const sealPlatform = readRepoFile("src/features/seal/sealPlatform.ts");
  const rateLimit = readRepoFile("lib/api-rate-limit.ts");
  assert.match(config, /SEAL_STAGING_MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.match(config, /SEAL_LOCAL_MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.match(config, /SEAL_STAGING_PLUS_MAX_BYTES/);
  assert.match(config, /SEAL_STAGING_DB_INLINE_MAX_BYTES = 1024 \* 1024/);
  assert.match(config, /SEAL_STAGING_INLINE_POST_MAX_BYTES/);
  assert.match(config, /SEAL_STAGING_CHUNK_BYTES/);
  assert.match(server, /storeSealStagingChunk/);
  assert.match(stagingRoute, /mode === "chunk"/);
  assert.match(readRepoFile("src/features/seal/sealStagingClient.ts"), /uploadSealStagingChunked/);
  assert.match(readRepoFile("src/features/seal/sealMediaPrep.ts"), /buildSealPayloadFromDraft/);
  assert.match(readRepoFile("src/features/seal/sealMediaPrep.ts"), /assertDraftFitsSealBudget/);
  assert.match(readRepoFile("src/features/seal/sealUserMessages.ts"), /throwSealStagingTooLarge/);
  assert.match(readRepoFile("src/features/seal/sealPrepBundle.ts"), /sealPrepBundle/);
  assert.match(readRepoFile("lib/subscription.ts"), /canSealWithRing: true/);
  assert.match(config, /SEAL_STAGING_FALLBACK_ENABLED/);
  assert.match(server, /createSealStagingRecord/);
  assert.match(server, /resolveSealStagingCiphertext/);
  assert.match(server, /purgeExpiredSealStaging/);
  assert.match(migration, /storage_backend/);
  assert.match(migration, /seal-staging/);
  assert.match(cronRoute, /purgeExpiredSealStaging/);
  assert.match(cronRoute, /authorizeCronRequest/);
  assert.match(vercel, /purge-seal-staging/);
  assert.match(vercel, /0 4 \* \* \*/);
  assert.doesNotMatch(vercel, /\*\/5/);
  assert.match(readRepoFile("lib/cron-auth.ts"), /CRON_ALLOWED_IPS/);
  assert.match(readRepoFile("lib/cron-auth.ts"), /x-cron-secret/i);
  assert.match(readRepoFile("lib/cron-auth.ts"), /vercel-cron/);
  assert.match(sealPlatform, /getSealStrategy/);
  assert.match(sealPlatform, /platform === "ios"/);
  assert.match(
    sealPlatform,
    /preferSameTabWebNfc: false[\s\S]*SDM rings expose picc_data/
  );
  assert.match(rateLimit, /enforceUserRateLimit/);
  assert.match(rateLimit, /sealStagingCreate/);
  assert.match(readRepoFile("src/features/seal/sealStagingClient.ts"), /signed_url/);
  assert.match(readRepoFile("lib/seal-staging-telemetry.ts"), /endpoint: "staging"/);
});

check("seal session boundary: no background auto-arm; live size meter on compose", () => {
  const newMemory = readRepoFile("src/views/NewMemoryPage.js");
  const sealFlow = readRepoFile("src/features/seal/sealFlowClient.ts");
  const sessionBoundary = readRepoFile("src/features/seal/sealSessionBoundary.ts");
  const appRouter = readRepoFile("src/app-shell/AppRouter.tsx");
  const deviceTrust = readRepoFile("src/services/deviceTrustService.js");
  const sealMediaPrep = readRepoFile("src/features/seal/sealMediaPrep.ts");
  assert.doesNotMatch(newMemory, /triggerAutoSealPrep/);
  assert.doesNotMatch(newMemory, /redirectToSealWaitIfArmed/);
  assert.doesNotMatch(newMemory, /openSealPromptOnSuccess/);
  assert.doesNotMatch(newMemory, /requiresSealStepUp/);
  assert.match(newMemory, /persistDraftOnBackgroundRef/);
  assert.match(newMemory, /evaluateComposerSealSize/);
  assert.match(sealMediaPrep, /evaluateComposerSealSize/);
  assert.match(sealMediaPrep, /toServerSealCommitPayload/);
  assert.match(sealMediaPrep, /dataUrl/);
  assert.doesNotMatch(sealFlow, /requiresSealStepUp\(\)/);
  assert.match(sessionBoundary, /abandonSealPrepOnSessionBoundary/);
  assert.doesNotMatch(sessionBoundary, /markSealStepUpRequired/);
  assert.match(appRouter, /bindSealSessionBoundaryListeners/);
  assert.match(deviceTrust, /markSealStepUpRequired/);
  assert.match(deviceTrust, /clearSealStepUpRequired/);
  const recovery = readRepoFile("src/features/seal/sealComposerRecovery.ts");
  assert.doesNotMatch(recovery, /armSealFlowWithPersistence/);
});

check("seal commit persists memories to local timeline", () => {
  const sealFlow = readRepoFile("src/features/seal/sealFlowClient.ts");
  assert.match(sealFlow, /persistSealedDraftsLocally/);
  assert.match(sealFlow, /persistSealedDraftsLocally/);
  assert.match(sealFlow, /removeDraftItem/);
  assert.match(sealFlow, /clearComposerSnapshot/);
  assert.match(sealFlow, /createMemory/);
  assert.match(sealFlow, /is_sealed: true/);
  assert.match(sealFlow, /readSealDraftRelay/);
  assert.match(sealFlow, /normalizePhotosForStorage/);
  assert.match(readRepoFile("src/features/seal/sealDraftRelay.ts"), /writeSealDraftRelay/);
  const recovery = readRepoFile("src/features/seal/sealComposerRecovery.ts");
  assert.match(recovery, /existingPhotos/);
  assert.match(recovery, /Does NOT arm seal/);
});

check("pair photo sync: portable dataUrl in vault and detail resolver", () => {
  const photoDisplay = readRepoFile("lib/memory-photo-display.ts");
  const detail = readRepoFile("src/views/MemoryDetailPage.js");
  assert.match(photoDisplay, /resolveMemoryPhotoUrl/);
  assert.match(photoDisplay, /blob:/);
  assert.match(detail, /resolveMemoryPhotoUrl/);
});

check("supplements merge preserves existing on empty incoming", () => {
  const existing = [
    { id: "n1", text: "hello", createdAt: 1000 },
  ];
  assert.deepEqual(mergeSupplements(existing, null), existing);
  assert.deepEqual(mergeSupplements(existing, undefined), existing);
  assert.deepEqual(mergeSupplements(existing, []), existing);
  const merged = mergeSupplements(existing, [
    { id: "n2", text: "world", createdAt: 2000 },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.id, "n1");
  assert.equal(merged[1]?.id, "n2");
});

console.log("\nAll flow contract checks passed.");
