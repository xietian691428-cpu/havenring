/**
 * Silent login: read NFC tag UID → POST /api/auth/nfc-login → Supabase session.
 * No account picker; failures surface as toast/message only.
 */

import { readNfcScanFull } from "./nfcRingService";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getKeepSignedInPreference } from "./deviceTrustService";
import { normalizeNfcUidInput } from "@/lib/nfc-uid-browser";
import {
  computeRingUidKey,
  setActiveRingFromNormalizedUid,
  upsertBoundRingByUidKey,
} from "./ringRegistryService";

export async function loginWithNormalizedUid(normalizedUid) {
  const uid = normalizeNfcUidInput(normalizedUid);
  if (!uid) {
    throw new Error("invalid_uid");
  }

  const res = await fetch("/api/auth/nfc-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nfc_uid: uid,
      prefer_long_session: getKeepSignedInPreference(),
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error || "nfc_login_failed");
    err.code = payload.code;
    throw err;
  }

  const access_token = payload.access_token;
  if (!access_token || typeof access_token !== "string") {
    throw new Error("missing_access_token");
  }

  const sb = getSupabaseBrowserClient();
  /** Supabase requires both fields; custom JWT refresh uses empty placeholder when absent. */
  const { error } = await sb.auth.setSession({
    access_token,
    refresh_token: payload.refresh_token || access_token,
  });

  if (error) {
    throw error;
  }

  await setActiveRingFromNormalizedUid(uid);
  upsertBoundRingByUidKey(computeRingUidKey(uid), {
    cloudRingId: payload.ring_id || null,
    cloudLastUsedAt: new Date().toISOString(),
  });

  return { ring_id: payload.ring_id, expires_in: payload.expires_in };
}

/**
 * Full flow: Web NFC scan → normalize UID from serial or NDEF fallback → login.
 */
export async function silentLoginViaNfcScan() {
  const scan = await readNfcScanFull();
  const raw = scan.serialNumber || scan.text || "";
  let normalized = normalizeNfcUidInput(raw);
  if (!normalized && scan.text) {
    normalized = normalizeNfcUidInput(scan.text);
  }
  if (!normalized) {
    throw new Error("no_uid_from_tag");
  }
  return loginWithNormalizedUid(normalized);
}
