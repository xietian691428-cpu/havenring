import { NextRequest, NextResponse } from "next/server";
import { normalizeNfcUidInput } from "@/lib/nfc-uid";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";

type LoginBody = { nfc_uid?: unknown };

/**
 * POST /api/auth/nfc-login
 * Disabled for dual-account Haven pairs: a ring touch must never bootstrap a
 * browser into another person's OAuth account. Use Apple/Google sign-in, then
 * tap the ring for Haven-scoped access.
 */
export async function POST(req: NextRequest) {
  try {
    const limitRes = await enforceIpRateLimit({
      req,
      scope: "nfc-login",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json()) as LoginBody;
    const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid : "";
    const normalized = normalizeNfcUidInput(rawUid);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid nfc_uid." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Ring-only sign-in is disabled. Sign in with your own Apple or Google account.",
        code: "nfc_login_disabled_for_shared_haven",
      },
      { status: 410 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
