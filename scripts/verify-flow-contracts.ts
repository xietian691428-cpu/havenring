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
  assert.match(bindRoute, /Each partner account can link one active ring/);
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
  assert.match(bindClient, /importHavenKeyFromInvitePackage/);
  assert.match(bindClient, /uploadWrappedHavenKey/);
  assert.match(keyService, /RSA-OAEP/);
  assert.match(shareInvite, /navigator\.share/);
});

check("daily access routes by Haven membership", () => {
  const resolveRoute = readRepoFile("app/api/rings/sdm/resolve/route.ts");
  const startClient = readRepoFile("app/start/StartClient.tsx");
  const timing = readRepoFile("lib/nfc-flow-timing.ts");
  assert.match(resolveRoute, /currentUserIsHavenMember/);
  assert.match(startClient, /isDailyMember/);
  assert.match(startClient, /minimalNfcCopy/);
  assert.match(startClient, /getNfcHoldGuideCopy/);
  assert.match(startClient, /enterRingWaitMode/);
  assert.match(startClient, /NfcHoldGuide/);
  assert.match(startClient, /NfcSyncedCountdown/);
  assert.match(readRepoFile("src/hooks/useActionStepCountdown.js"), /useDeadlineCountdown/);
  assert.match(readRepoFile("src/views/NewMemoryPage.js"), /IndeterminateStepStatus/);
  assert.match(readRepoFile("src/views/TimelinePage.js"), /syncIssueOffline/);
  assert.match(readRepoFile("lib/sync-failure.ts"), /classifySyncFailure/);
  assert.doesNotMatch(readRepoFile("src/views/TimelinePage.js"), /syncRetryCountdown/);
  assert.doesNotMatch(readRepoFile("app/bind-ring/bind-ring-client.tsx"), /ActionStepCountdown/);
  assert.match(readRepoFile("src/components/IndeterminateStepStatus.tsx"), /IndeterminateStepStatus/);
  assert.match(startClient, /readingCountdownPrefix/);
  assert.match(startClient, /retryCountdownPrefix/);
  assert.match(startClient, /openingHavenLine/);
  assert.doesNotMatch(startClient, /redirectCountdownPrefix/);
  assert.match(timing, /minFailedBeforeRetryMs/);
  assert.doesNotMatch(startClient, /isDailySelfOwner/);
  assert.doesNotMatch(startClient, /window\.location\.reload\(\)/);
});

check("timeline sync does not fail when optional cloud backup is off", () => {
  const sync = readRepoFile("src/services/ringSyncService.js");
  const backup = readRepoFile("src/services/cloudBackupService.js");
  assert.match(backup, /isCloudBackupReady/);
  assert.match(sync, /isCloudBackupReady/);
  assert.match(sync, /if \(!cloudBackupReady\)/);
  assert.match(sync, /clearRingSyncQueue/);
  assert.match(sync, /isCriticalSyncIssue/);
  assert.match(sync, /\/api\/sync\/moments/);
  assert.match(readRepoFile("app/api/sync/moments/route.ts"), /requireAuthenticatedUser/);
});

check("seal commit persists memories to local timeline", () => {
  const sealFlow = readRepoFile("src/features/seal/sealFlowClient.ts");
  assert.match(sealFlow, /persistSealedDraftsLocally/);
  assert.match(sealFlow, /await persistSealedDraftsLocally\(draftIds\)/);
  assert.match(sealFlow, /removeDraftItem/);
  assert.match(sealFlow, /clearComposerSnapshot/);
  assert.match(sealFlow, /createMemory/);
});

console.log("\nAll flow contract checks passed.");
