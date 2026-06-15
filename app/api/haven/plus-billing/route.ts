import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import { setHavenPlusBillingUser } from "@/lib/haven-plus";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

type Body = {
  haven_id?: unknown;
  billing_user_id?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-plus-billing",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const { getUserSubscriptionContext } = await import("@/lib/subscription");
    const admin = getSupabaseAdminClient();
    const ctx = await getUserSubscriptionContext(admin, user.id);
    return NextResponse.json({ ok: true, ...ctx });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Pair member chooses which account pays for Haven Plus. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-plus-billing-set",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as Body;
    const havenId = typeof body.haven_id === "string" ? body.haven_id.trim() : "";
    const billingUserId =
      typeof body.billing_user_id === "string" ? body.billing_user_id.trim() : "";
    if (!havenId || !billingUserId) {
      return NextResponse.json(
        { error: "haven_id and billing_user_id required." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const resolved = await setHavenPlusBillingUser(
      admin,
      havenId,
      billingUserId,
      user.id
    );

    return NextResponse.json({
      ok: true,
      havenPlus: {
        havenId: resolved.havenId,
        billingUserId: resolved.billingUserId,
        isBillingAccount: resolved.billingUserId === user.id,
        pairActive: resolved.pairActive,
        memberCount: resolved.memberCount,
      },
      subscription: resolved.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (message === "FORBIDDEN" || message === "BILLING_USER_NOT_IN_HAVEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
