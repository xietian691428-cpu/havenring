import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import {
  getSupabaseUserClient,
  isAnonymousUser,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

const MAX_RINGS = 5;

type BindBody = {
  nfc_uid?: unknown;
  nickname?: unknown;
  privacy_acknowledged?: unknown;
};

/**
 * POST /api/nfc/bind
 * Binds a ring UID (hashed server-side) to the authenticated user.
 * Requires: Bearer session, explicit privacy acknowledgment, and a secondary
 * verification signal (e.g. after device passcode / passkey) via header.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "Permanent account required for NFC bind." },
        { status: 403 }
      );
    }

    const limit = await hitRateLimitWithRedisFallback(
      `nfc-bind:${user.id}`,
      20,
      60_000
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
          },
        }
      );
    }

    const secondary = req.headers.get("x-haven-secondary-verified");
    if (secondary !== "1") {
      return NextResponse.json(
        {
          error: "Secondary verification required.",
          code: "secondary_verification_required",
          hint: "Complete device / passkey verification, then set X-Haven-Secondary-Verified: 1.",
        },
        { status: 403 }
      );
    }

    const body = (await req.json()) as BindBody;
    const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid : "";
    const normalized = normalizeNfcUidInput(rawUid);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid nfc_uid." }, { status: 400 });
    }
    if (body.privacy_acknowledged !== true) {
      return NextResponse.json(
        { error: "privacy_acknowledged must be true." },
        { status: 400 }
      );
    }

    const uidHash = hashNfcUid(normalized);
    const nickname = String(body.nickname ?? "").trim() || "Ring";
    const accessToken = requireBearerToken(req);
    const supabase = getSupabaseUserClient(accessToken);

    const { count, error: countError } = await supabase
      .from("user_nfc_rings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (countError) {
      return NextResponse.json(
        { error: countError.message || "Count failed." },
        { status: 500 }
      );
    }
    if ((count ?? 0) >= MAX_RINGS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_RINGS} active rings per account.` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from("user_nfc_rings")
      .insert({
        user_id: user.id,
        nfc_uid_hash: uidHash,
        nickname,
        bound_at: new Date().toISOString(),
        is_active: true,
      })
      .select("id, nickname, bound_at, is_active")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This ring is already bound to your account." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ring: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
