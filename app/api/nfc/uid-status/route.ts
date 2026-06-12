import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";
import { hashNfcUidAliases, normalizeNfcUidInput } from "@/lib/nfc-uid";
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
  /** True when the ring belongs to a Haven the caller is a member of. */
  linkedToYourHaven: boolean;
  /** True when linked to a different permanent account than the caller. */
  linkedToOtherAccount: boolean;
  nonTransferable: boolean;
  havenId: string | null;
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

  const uidHashCandidates = hashNfcUidAliases(raw);
  if (!uidHashCandidates.length) {
    return NextResponse.json({ error: "uid query required." }, { status: 400 });
  }
  const admin = getSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("user_nfc_rings")
    .select("user_id, haven_id, is_active, retired_at")
    .in("nfc_uid_hash", uidHashCandidates)
    .order("is_active", { ascending: false })
    .order("bound_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Lookup failed." },
      { status: 500 }
    );
  }

  const linked = Boolean(row?.user_id && row.is_active);
  const nonTransferable = Boolean(row?.user_id && (!row.is_active || row.retired_at));
  const ownedByYou = Boolean(linked && viewerId && row?.user_id === viewerId);
  /** @deprecated Legacy pair scope — not implicit memory sharing (Phase 5). */
  let linkedToYourHaven = false;

  if (linked && viewerId && row?.haven_id) {
    const { data: membership } = await admin
      .from("haven_members")
      .select("id")
      .eq("haven_id", row.haven_id)
      .eq("user_id", viewerId)
      .maybeSingle();
    linkedToYourHaven = Boolean(membership);
  }
  const linkedToOtherAccount = Boolean(
    linked && viewerId && row?.user_id !== viewerId && !linkedToYourHaven
  );

  const body: UidStatusJson = {
    linked,
    ownedByYou,
    linkedToYourHaven,
    linkedToOtherAccount,
    nonTransferable,
    havenId: row?.haven_id ?? null,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
