/**
 * Phase 1 Seal local-first simulations (no browser).
 * Run: npx tsx scripts/verify-seal-local-first.ts
 */
import assert from "node:assert/strict";
import { formatBackgroundSyncStatusLine } from "../lib/background-sync-status-copy";
import { slimSealRelayPayload } from "../lib/seal-relay-slim";
import { SEAL_LOCAL_RELAY_MAX_BYTES } from "../lib/seal-local-limits";

const SETTINGS_COPY = {
  backgroundSyncPendingOne:
    "1 sealed memory finishing backup in the background.",
  backgroundSyncPendingMany:
    "{n} sealed memories finishing backup in the background.",
  backgroundSyncOffline: "Will continue backup when you're back online.",
};

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${label}`);
  } catch (error) {
    console.error(`✗ ${label}`);
    throw error;
  }
}

check("offline seal → Settings shows gentle offline backup line", () => {
  const line = formatBackgroundSyncStatusLine(
    { pending: 1, online: false },
    SETTINGS_COPY
  );
  assert.equal(line, SETTINGS_COPY.backgroundSyncOffline);
});

check("online + 2 pending → plural background backup line", () => {
  const line = formatBackgroundSyncStatusLine(
    { pending: 2, online: true },
    SETTINGS_COPY
  );
  assert.equal(
    line,
    "2 sealed memories finishing backup in the background."
  );
});

check("no pending queue → empty Settings line", () => {
  assert.equal(
    formatBackgroundSyncStatusLine({ pending: 0, online: true }, SETTINGS_COPY),
    ""
  );
});

check("large photo (3MB) fits 500MB relay cap — offline seal retains photo", () => {
  const dataUrl = `data:image/jpeg;base64,${"A".repeat(3_000_000)}`;
  const payload = {
    id: "mem-3mb",
    title: "Trip",
    story: "Large but under relay cap.",
    photo: [{ id: "p1", dataUrl, mimeType: "image/jpeg", size: 3_000_000 }],
    attachments: [],
    releaseAt: 0,
  };
  const slimmed = slimSealRelayPayload(payload, SEAL_LOCAL_RELAY_MAX_BYTES);
  assert.equal(slimmed.photo.length, 1);
  assert.ok(JSON.stringify(slimmed).length < SEAL_LOCAL_RELAY_MAX_BYTES);
});

check("relay budget exceeded → text kept, photos trimmed (degraded offline seal)", () => {
  const tightCap = 5_000;
  const hugeDataUrl = `data:image/jpeg;base64,${"A".repeat(8_000)}`;
  const payload = {
    id: "mem-tight",
    title: "Beach day",
    story: "Title and story survive relay trim.",
    photo: [{ id: "p1", dataUrl: hugeDataUrl, mimeType: "image/jpeg", size: 40_000 }],
    attachments: [],
    releaseAt: 0,
  };
  const slimmed = slimSealRelayPayload(payload, tightCap);
  assert.equal(slimmed.title, payload.title);
  assert.equal(slimmed.story, payload.story);
  assert.equal(slimmed.photo.length, 0, "photo dropped when relay budget is tight");
  assert.ok(JSON.stringify(slimmed).length <= tightCap);
});

check("moderate photo relay retains at least one photo row", () => {
  const smallDataUrl = `data:image/jpeg;base64,${"B".repeat(8_000)}`;
  const payload = {
    id: "mem-small",
    title: "Note",
    story: "One photo fits relay.",
    photo: [{ id: "p1", dataUrl: smallDataUrl, mimeType: "image/jpeg", size: 8_000 }],
    attachments: [],
    releaseAt: 0,
  };
  const slimmed = slimSealRelayPayload(payload, SEAL_LOCAL_RELAY_MAX_BYTES);
  assert.equal(slimmed.photo.length, 1);
});

console.log("\nAll Seal local-first simulations passed.");
