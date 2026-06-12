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
  assert.match(readRepoFile("src/content/ringsPageContent.js"), /Share Invite Link/);
  assert.match(bindClient, /\/api\/haven\/invite\/key/);
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
  assert.match(bindClient, /joinBindCtaSetup/);
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
  assert.match(startClient, /retryCountdownPrefix/);
  assert.match(timing, /minFailedBeforeRetryMs/);
  assert.doesNotMatch(startClient, /window\.location\.reload\(\)/);
});

check("ring bind is optional not gated", () => {
  const machine = readRepoFile("src/state/appFlowMachine.js");
  const router = readRepoFile("src/app-shell/AppRouter.tsx");
  const wizard = readRepoFile("src/components/RingSetupWizard.js");
  assert.doesNotMatch(machine, /RING_SETUP_GATE/);
  assert.match(router, /\/bind-ring/);
  assert.doesNotMatch(router, /RingSetupWizard/);
  assert.match(wizard, /\/bind-ring/);
  assert.match(readRepoFile("src/content/havenCopy.ts"), /Your ring is for sealing/);
});

check("phase 5 personal-first ring access and legacy invite de-emphasized", () => {
  const access = readRepoFile("lib/haven-access.ts");
  const membership = readRepoFile("lib/haven-membership.ts");
  const syncMoments = readRepoFile("app/api/sync/moments/route.ts");
  const sdmResolve = readRepoFile("app/api/rings/sdm/resolve/route.ts");
  const ringTap = readRepoFile("app/api/seal/ring-tap/route.ts");
  const ringsPage = readRepoFile("src/views/RingsPage.js");
  const ringsContent = readRepoFile("src/content/ringsPageContent.js");
  const migrationManual = readRepoFile("docs/group-haven-migration-manual.md");
  assert.match(access, /userCanSealWithRing/);
  assert.match(access, /isLegacyHavenMember/);
  assert.match(membership, /owner-only/);
  assert.match(syncMoments, /eq\("user_id", user\.id\)/);
  assert.doesNotMatch(syncMoments, /from\("haven_members"\)/);
  assert.match(sdmResolve, /RING_OWNER_REQUIRED/);
  assert.match(ringTap, /RING_OWNER_REQUIRED/);
  assert.match(ringsPage, /legacyCard/);
  assert.match(ringsContent, /legacySecondRingTitle/);
  assert.match(migrationManual, /LEGACY — Phase 5/);
});

check("cloud backup 50GB quota compress and chunk upload", () => {
  const config = readRepoFile("lib/cloud-storage-config.ts");
  const server = readRepoFile("lib/cloud-storage-server.ts");
  const backup = readRepoFile("src/services/cloudBackupService.js");
  const quotaRoute = readRepoFile("app/api/cloud-backup/quota/route.ts");
  const uploadRoute = readRepoFile("app/api/cloud-backup/upload/route.ts");
  assert.match(config, /CLOUD_STORAGE_QUOTA_BYTES/);
  assert.match(config, /CLOUD_STORAGE_QUOTA_GB = PLUS_STORAGE_GB/);
  assert.match(config, /CLOUD_STORAGE_FULL_MESSAGE/);
  assert.match(server, /assertCloudQuotaHeadroom/);
  assert.match(backup, /compressPayloadForCloud/);
  assert.match(backup, /chunkBlobForCloudUpload/);
  assert.match(backup, /precheckCloudUpload/);
  assert.match(quotaRoute, /CLOUD_STORAGE_FULL/);
  assert.match(uploadRoute, /mode === "commit"/);
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
  assert.match(config, /SEAL_STAGING_MAX_BYTES = 20 \* 1024 \* 1024/);
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
  assert.match(rateLimit, /enforceUserRateLimit/);
  assert.match(rateLimit, /sealStagingCreate/);
  assert.match(readRepoFile("src/features/seal/sealStagingClient.ts"), /signed_url/);
  assert.match(readRepoFile("lib/seal-staging-telemetry.ts"), /endpoint: "staging"/);
});

check("seal session boundary: no background auto-arm; step-up before re-seal", () => {
  const newMemory = readRepoFile("src/views/NewMemoryPage.js");
  const sealFlow = readRepoFile("src/features/seal/sealFlowClient.ts");
  const sessionBoundary = readRepoFile("src/features/seal/sealSessionBoundary.ts");
  const appRouter = readRepoFile("src/app-shell/AppRouter.tsx");
  const deviceTrust = readRepoFile("src/services/deviceTrustService.js");
  assert.doesNotMatch(newMemory, /triggerAutoSealPrep/);
  assert.doesNotMatch(newMemory, /redirectToSealWaitIfArmed/);
  assert.doesNotMatch(newMemory, /openSealPromptOnSuccess/);
  assert.match(newMemory, /persistDraftOnBackgroundRef/);
  assert.match(newMemory, /requiresSealStepUp/);
  assert.match(newMemory, /verifyAndTrustCurrentDevice/);
  assert.match(sealFlow, /SEAL_STEP_UP_REQUIRED/);
  assert.match(sealFlow, /requiresSealStepUp\(\)/);
  assert.match(sessionBoundary, /abandonSealPrepOnSessionBoundary/);
  assert.match(sessionBoundary, /markSealStepUpRequired/);
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
  assert.match(readRepoFile("src/features/seal/sealDraftRelay.ts"), /writeSealDraftRelay/);
  const recovery = readRepoFile("src/features/seal/sealComposerRecovery.ts");
  assert.match(recovery, /existingPhotos/);
  assert.match(recovery, /Does NOT arm seal/);
});

console.log("\nAll flow contract checks passed.");
