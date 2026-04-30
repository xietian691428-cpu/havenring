import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
} from "@/lib/supabase/server";

type FirstRunBody = {
  event_name?: unknown;
  platform?: unknown;
  locale?: unknown;
  metadata?: unknown;
};

function normalizeText(input: unknown, fallback = "") {
  const text = String(input ?? "").trim();
  return text || fallback;
}

function normalizeMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  return input;
}

export async function POST(req: NextRequest) {
  try {
    const limitRes = await enforceIpRateLimit({
      req,
      scope: "first-run-telemetry",
      policy: API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;

    const body = (await req.json().catch(() => ({}))) as FirstRunBody;
    const eventName = normalizeText(body.event_name);
    if (!eventName) {
      return NextResponse.json(
        { error: "event_name required.", error_code: "INVALID_EVENT" },
        { status: 400 }
      );
    }
    const authHeader = req.headers.get("authorization") || "";
    let userId: string | null = null;
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      try {
        const user = await requireAuthenticatedUser(req);
        userId = user.id || null;
      } catch {
        userId = null;
      }
    }
    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("first_run_events" as never).insert(
      {
        user_id: userId,
        event_name: eventName,
        platform: normalizeText(body.platform) || null,
        locale: normalizeText(body.locale) || null,
        metadata: normalizeMetadata(body.metadata),
      } as never
    );
    if (error) {
      return NextResponse.json(
        { error: "Failed to store telemetry.", error_code: "STORE_FAILED" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unexpected error.", error_code: "UNEXPECTED_ERROR" },
      { status: 500 }
    );
  }
}
