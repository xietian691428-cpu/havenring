import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import {
  getOptionalAuthenticatedUser,
  getSupabaseAdminClient,
  isAnonymousUser,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type UidStatusJson = {
  linked: boolean;
  /** True only when the caller is signed in with a permanent account and owns the binding. */
  ownedByYou: boolean;
  /** True when linked to a different permanent account than the caller. */
  linkedToOtherAccount: boolean;
};

/**
 * GET /api/nfc/uid-status?uid=...
 * Public (rate-limited) read: whether this NFC UID already has an active Haven binding.
 * Optional Bearer: refines ownedByYou / linkedToOtherAccount for signed-in users.
 */
export async function GET(req: NextRequest) {
  const limitRes = await enforceIpRateLimit({
    req,
    scope: "nfc-uid-status",
    policy: API_RATE_POLICIES.ringMedium,
  });
  if (limitRes) return limitRes;

  const raw = req.nextUrl.searchParams.get("uid") || "";
  const normalized = normalizeNfcUidInput(raw);
  if (!normalized) {
    return NextResponse.json({ error: "uid query required." }, { status: 400 });
  }

  const viewer = await getOptionalAuthenticatedUser(req);
  const viewerId =
    viewer && !isAnonymousUser(viewer) ? viewer.id : null;

  const uidHash = hashNfcUid(normalized);
  const admin = getSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("user_nfc_rings")
    .select("user_id")
    .eq("nfc_uid_hash", uidHash)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Lookup failed." },
      { status: 500 }
    );
  }

  const linked = Boolean(row?.user_id);
  const ownedByYou = Boolean(linked && viewerId && row?.user_id === viewerId);
  const linkedToOtherAccount = Boolean(linked && viewerId && row?.user_id !== viewerId);

  const body: UidStatusJson = {
    linked,
    ownedByYou,
    linkedToOtherAccount,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
