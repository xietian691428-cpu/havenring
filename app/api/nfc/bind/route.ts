import { NextRequest, NextResponse } from "next/server";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  getSupabaseUserClient,
  isAnonymousUser,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import {
  activatePlusTrialForUser,
  getUserSubscriptionStatus,
} from "@/lib/subscription";

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
        { error: "A full Haven account is required for NFC bind." },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "nfc-bind",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

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

    const admin = getSupabaseAdminClient();
    const { data: existingGlobal, error: existingErr } = await admin
      .from("user_nfc_rings")
      .select("id, user_id")
      .eq("nfc_uid_hash", uidHash)
      .eq("is_active", true)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json(
        { error: existingErr.message || "Conflict check failed." },
        { status: 500 }
      );
    }
    if (existingGlobal) {
      if (existingGlobal.user_id === user.id) {
        return NextResponse.json(
          {
            error: "This ring is already linked to your account.",
            code: "ALREADY_BOUND_SELF",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error:
            "This ring is already linked to another Haven account. The owner must unlink it in My Rings before it can be linked here.",
          code: "RING_BOUND_TO_OTHER_USER",
        },
        { status: 409 }
      );
    }

    const subscription = await getUserSubscriptionStatus(supabase, user.id).catch(
      () => null
    );
    const ringLimit = subscription?.ringLimit ?? 1;

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
    if ((count ?? 0) >= ringLimit) {
      return NextResponse.json(
        {
          error:
            ringLimit === 1
              ? "Free supports 1 active ring. Upgrade to Haven Plus for up to 5 rings."
              : `Maximum ${ringLimit} active rings per account.`,
          code: "RING_LIMIT_REACHED",
          ringLimit,
        },
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
          {
            error:
              "This ring was linked in another tab or account. Refresh and try again, or unlink it from the other account first.",
            code: "BIND_CONFLICT",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const plusTrial = await activatePlusTrialForUser(supabase, user.id).catch(
      () => null
    );

    return NextResponse.json({
      ring: data,
      plusTrialActivated: Boolean(plusTrial?.trialJustActivated),
      plusTrialEnd: plusTrial?.plusTrialEnd ?? null,
      subscription: plusTrial,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    if (msg === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
