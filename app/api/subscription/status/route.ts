import { NextRequest, NextResponse } from "next/server";
import { getUserSubscriptionStatus } from "@/lib/subscription";
import { userEntitlementsFromSubscriptionStatus } from "@/src/features/subscription/subscriptionTypes";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Canonical entitlements snapshot for authenticated clients (server-derived).
 * `subscription` is included for transitional clients only.
 */
export async function GET(req: NextRequest) {
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const admin = getSupabaseAdminClient();
    const subscription = await getUserSubscriptionStatus(admin, user.id);
    const entitlements = userEntitlementsFromSubscriptionStatus(subscription);
    return NextResponse.json({ ok: true, entitlements, subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("[subscription/status]", error);
    return NextResponse.json(
      { ok: false, error: "Unexpected error." },
      { status: 500 }
    );
  }
}
