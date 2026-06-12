/** @deprecated Legacy haven_member_keys wrap for second-ring invite recovery (Phase 5). */
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

type MemberKeyBody = {
  haven_id?: unknown;
  public_key_jwk?: unknown;
  wrapped_haven_key?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "haven-member-key",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as MemberKeyBody;
    const havenId = typeof body.haven_id === "string" ? body.haven_id.trim() : "";
    if (!havenId || !isRecord(body.public_key_jwk) || !isRecord(body.wrapped_haven_key)) {
      return NextResponse.json({ error: "Invalid member key payload." }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: member, error: memberErr } = await admin
      .from("haven_members")
      .select("id")
      .eq("haven_id", havenId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json({ error: "Forbidden.", code: "FORBIDDEN" }, { status: 403 });
    }

    const { error } = await admin.from("haven_member_keys" as never).upsert(
      {
        haven_id: havenId,
        user_id: user.id,
        public_key_jwk: body.public_key_jwk,
        wrapped_haven_key: body.wrapped_haven_key,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "haven_id,user_id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
