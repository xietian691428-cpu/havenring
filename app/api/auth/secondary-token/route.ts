import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserRateLimit } from "@/lib/api-rate-limit";
import { mintSecondaryVerificationToken } from "@/lib/secondary-verification";
import {
  isAnonymousUser,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

/**
 * POST /api/auth/secondary-token
 * Issues a short-lived, single-use token for high-risk NFC actions (bind / revoke).
 * Client should call this only after local device password verification.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    if (isAnonymousUser(user)) {
      return NextResponse.json(
        { error: "A full Haven account is required." },
        { status: 403 }
      );
    }

    const limitRes = await enforceUserRateLimit({
      userId: user.id,
      scope: "secondary-token",
      policy: API_RATE_POLICIES.secondaryToken,
    });
    if (limitRes) return limitRes;

    const { token, expiresInSec } = await mintSecondaryVerificationToken(user.id);
    return NextResponse.json({
      token,
      expires_in: expiresInSec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
