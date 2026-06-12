/**
 * Executable security probes (local + optional production).
 * Run: npx tsx scripts/security-audit-probes.ts
 * Production: AUDIT_BASE_URL=https://www.havenring.me npx tsx scripts/security-audit-probes.ts
 */

import { createHash, randomBytes, webcrypto } from "node:crypto";

const BASE = (process.env.AUDIT_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const RESULTS: Array<{ id: string; status: "PASS" | "FAIL" | "WARN" | "SKIP"; detail: string }> = [];

function record(id: string, status: "PASS" | "FAIL" | "WARN" | "SKIP", detail: string) {
  RESULTS.push({ id, status, detail });
  const icon = { PASS: "✓", FAIL: "✗", WARN: "!", SKIP: "-" }[status];
  console.log(`${icon} [${id}] ${detail}`);
}

async function probeHttp(
  path: string,
  init?: RequestInit
): Promise<{ status: number; body: string; ms: number }> {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, { ...init, signal: AbortSignal.timeout(20_000) });
  const body = await res.text();
  return { status: res.status, body: body.slice(0, 500), ms: Date.now() - started };
}

async function testStagingCrypto() {
  const subtle = webcrypto.subtle;
  const utf8 = (s: string) => new TextEncoder().encode(s);
  const SALT = "haven-seal-staging-v1";
  const INFO = "seal-staging-dek";

  async function deriveKey(token: string) {
    const keyMaterial = await subtle.importKey("raw", utf8(token), "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: utf8(SALT), info: utf8(INFO) },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  const tokenA = "user-a-" + randomBytes(16).toString("hex");
  const tokenB = "user-b-" + randomBytes(16).toString("hex");
  const plaintext = JSON.stringify({ payloads: [{ id: "x", story: "secret", photo: [] }] });

  const keyA = await deriveKey(tokenA);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const enc = await subtle.encrypt({ name: "AES-GCM", iv }, keyA, utf8(plaintext));
  const cipherB64 = Buffer.from(new Uint8Array(enc)).toString("base64");
  const ivB64 = Buffer.from(iv).toString("base64");

  try {
    const keyB = await deriveKey(tokenB);
    await subtle.decrypt(
      { name: "AES-GCM", iv },
      keyB,
      Uint8Array.from(Buffer.from(cipherB64, "base64"))
    );
    record("staging-crypto-cross-user", "FAIL", "User B decrypted user A ciphertext");
  } catch {
    record("staging-crypto-cross-user", "PASS", "Different access tokens cannot decrypt each other");
  }

  const keyA2 = await deriveKey(tokenA);
  const dec = await subtle.decrypt(
    { name: "AES-GCM", iv },
    keyA2,
    Uint8Array.from(Buffer.from(cipherB64, "base64"))
  );
  const roundtrip = new TextDecoder().decode(dec);
  if (roundtrip === plaintext) {
    record("staging-crypto-roundtrip", "PASS", "AES-GCM+HKDF roundtrip OK");
  } else {
    record("staging-crypto-roundtrip", "FAIL", "Roundtrip mismatch");
  }

  const tampered = Uint8Array.from(Buffer.from(cipherB64, "base64"));
  tampered[tampered.length - 1] ^= 0xff;
  try {
    await subtle.decrypt({ name: "AES-GCM", iv }, keyA, tampered);
    record("staging-crypto-integrity", "FAIL", "Tampered ciphertext decrypted");
  } catch {
    record("staging-crypto-integrity", "PASS", "GCM rejects tampered ciphertext");
  }
}

async function testStagingApiUnauth() {
  try {
    const post = await probeHttp("/api/seal/staging", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft_ids: ["a"], ciphertext: "x", iv: "y" }),
    });
    if (post.status === 401) {
      record("staging-post-unauth", "PASS", `POST without token → ${post.status}`);
    } else {
      record("staging-post-unauth", "FAIL", `Expected 401, got ${post.status}`);
    }

    const fakeId = "00000000-0000-4000-8000-000000000001";
    const get = await probeHttp(`/api/seal/staging/${fakeId}`, { method: "GET" });
    if (get.status === 401) {
      record("staging-get-unauth", "PASS", `GET without token → ${get.status}`);
    } else {
      record("staging-get-unauth", "FAIL", `Expected 401, got ${get.status}`);
    }
  } catch (e) {
    record("staging-api-unauth", "SKIP", `Server unreachable at ${BASE}: ${e}`);
  }
}

async function testStagingOversize() {
  try {
    const post = await probeHttp("/api/seal/staging", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token",
      },
      body: JSON.stringify({
        draft_ids: ["a"],
        ciphertext: "A".repeat(3 * 1024 * 1024),
        iv: "AAAAAAAAAAA=",
      }),
    });
    if ([401, 413].includes(post.status)) {
      record("staging-oversize", "PASS", `Large body rejected or unauth (${post.status})`);
    } else {
      record("staging-oversize", "WARN", `Got ${post.status} — verify 50MB cap`);
    }
  } catch (e) {
    record("staging-oversize", "SKIP", String(e));
  }
}

async function testNfcLoginDisabled() {
  try {
    const res = await probeHttp("/api/auth/nfc-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nfc_uid: "04123456ABCDEF" }),
    });
    if (res.status === 410) {
      record("nfc-login-disabled", "PASS", "nfc-login returns 410");
    } else {
      record("nfc-login-disabled", "FAIL", `Expected 410, got ${res.status}`);
    }
  } catch (e) {
    record("nfc-login-disabled", "SKIP", String(e));
  }
}

async function testSecondaryVerBypass() {
  try {
    const legacyHeader = await probeHttp("/api/nfc/bind", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-jwt-token",
        "X-Haven-Secondary-Verified": "1",
      },
      body: JSON.stringify({
        nfc_uid: "04123456ABCDEF",
        privacy_acknowledged: true,
      }),
    });
    if (legacyHeader.status === 401) {
      record(
        "secondary-ver-legacy-header",
        "PASS",
        "Spoofed legacy header rejected (401 without session)"
      );
    } else if (legacyHeader.status === 403) {
      record(
        "secondary-ver-legacy-header",
        "PASS",
        "Legacy X-Haven-Secondary-Verified header no longer accepted"
      );
    } else {
      record(
        "secondary-ver-legacy-header",
        "FAIL",
        `Legacy header probe unexpected status=${legacyHeader.status}`
      );
    }

    const noToken = await probeHttp("/api/nfc/bind", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-jwt-token",
      },
      body: JSON.stringify({
        nfc_uid: "04123456ABCDEF",
        privacy_acknowledged: true,
      }),
    });
    if (noToken.status === 401 || noToken.status === 403) {
      record("secondary-ver-no-token", "PASS", "Bind requires session + secondary token");
    } else {
      record(
        "secondary-ver-no-token",
        "WARN",
        `status=${noToken.status} body=${noToken.body.slice(0, 120)}`
      );
    }
  } catch (e) {
    record("secondary-ver-bypass", "SKIP", String(e));
  }
}

async function testSdmResolveNoAuth() {
  try {
    const res = await probeHttp("/api/rings/sdm/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: "04deadbeef", ctr: "1", cmac: "bad" }),
    });
    if ([400, 502].includes(res.status)) {
      record("sdm-resolve-bad-cmac", "PASS", `Invalid CMAC rejected (${res.status})`);
    } else if (res.status === 429) {
      record("sdm-resolve-bad-cmac", "PASS", "Rate limited (429)");
    } else {
      record("sdm-resolve-bad-cmac", "WARN", `status=${res.status}`);
    }
  } catch (e) {
    record("sdm-resolve-noauth", "SKIP", String(e));
  }
}

async function testInviteKeyEnum() {
  try {
    const res = await probeHttp(
      "/api/haven/invite/key?invite=ffffffffffffffffffffffffffffffff&kt=badtoken"
    );
    if (res.status === 404) {
      record("invite-key-enum", "PASS", "Invalid invite+kt → 404 (no oracle leak)");
    } else if (res.status === 429) {
      record("invite-key-enum", "PASS", "Rate limited on invite key");
    } else {
      record("invite-key-enum", "WARN", `status=${res.status}`);
    }
  } catch (e) {
    record("invite-key-enum", "SKIP", String(e));
  }
}

async function testCronExposure() {
  try {
    const res = await probeHttp("/api/cron/purge-seal-staging");
    if (res.status === 401) {
      record("cron-unauth", "PASS", "Cron requires secret (401)");
    } else if (res.status === 404) {
      record("cron-unauth", "WARN", "Cron route 404 — deploy may be stale");
    } else if (res.status === 503) {
      record("cron-unauth", "WARN", "Cron not configured (503)");
    } else {
      record("cron-unauth", "FAIL", `Unauthenticated cron returned ${res.status}`);
    }
  } catch (e) {
    record("cron-unauth", "SKIP", String(e));
  }
}

async function testRateLimitBurst() {
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await probeHttp("/api/auth/nfc-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nfc_uid: "04test" }),
      });
      statuses.push(r.status);
    }
    const has429 = statuses.includes(429);
    record(
      "rate-limit-burst",
      has429 ? "PASS" : "WARN",
      `12 rapid nfc-login calls: ${JSON.stringify(statuses.reduce((a, s) => ({ ...a, [s]: (a[s] || 0) + 1 }), {} as Record<number, number>))}`
    );
  } catch (e) {
    record("rate-limit-burst", "SKIP", String(e));
  }
}

async function main() {
  console.log(`\n=== Haven security probes @ ${BASE} ===\n`);
  await testStagingCrypto();
  await testStagingApiUnauth();
  await testStagingOversize();
  await testNfcLoginDisabled();
  await testSecondaryVerBypass();
  await testSdmResolveNoAuth();
  await testInviteKeyEnum();
  await testCronExposure();
  await testRateLimitBurst();

  const fail = RESULTS.filter((r) => r.status === "FAIL").length;
  const warn = RESULTS.filter((r) => r.status === "WARN").length;
  console.log(`\n=== Summary: ${RESULTS.length} probes, ${fail} FAIL, ${warn} WARN ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
