/**
 * Smoke checks for Auth / NFC intent / Seal URL contracts after refactors.
 * Run: npx tsx scripts/verify-flow-contracts.ts
 */
import assert from "node:assert/strict";
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

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✗ ${label}`);
    throw error;
  }
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
});

console.log("\nAll flow contract checks passed.");
