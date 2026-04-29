import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { signSupabaseAccessJwt } from "@/lib/supabase-access-jwt";

type LoginBody = { nfc_uid?: unknown; prefer_long_session?: unknown };

const DEFAULT_ACCESS_SEC = 60 * 60 * 24 * 90; // 90 days
const LONG_ACCESS_CAP_SEC = 60 * 60 * 24 * 365 * 10; // “stay signed in” cap

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * POST /api/auth/nfc-login
 * Validates an NFC UID against an active binding and returns a long-lived JWT
 * when `SUPABASE_JWT_SECRET` is configured (same secret as Supabase Auth).
 *
 * Default access lifetime is 90 days (`NFC_ACCESS_TOKEN_SECONDS`); with
 * `prefer_long_session` the client can request the long cap (`NFC_LONG_SESSION_MAX_SECONDS`, default 10y).
 * No GoTrue refresh token; re-tap the ring or use OAuth. See docs/security-checklist-tests.md.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await hitRateLimitWithRedisFallback(
      `nfc-login-ip:${ip}`,
      40,
      60_000
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as LoginBody;
    const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid : "";
    const preferLong =
      body.prefer_long_session === true || body.prefer_long_session === "true";
    const defaultSec = envInt("NFC_ACCESS_TOKEN_SECONDS", DEFAULT_ACCESS_SEC);
    const longSessionSec = envInt(
      "NFC_LONG_SESSION_MAX_SECONDS",
      LONG_ACCESS_CAP_SEC
    );
    const accessTtlSec = preferLong ? longSessionSec : defaultSec;
    const normalized = normalizeNfcUidInput(rawUid);
    if (!normalized) {
      return NextResponse.json({ error: "Invalid nfc_uid." }, { status: 400 });
    }

    const uidHash = hashNfcUid(normalized);
    const admin = getSupabaseAdminClient();

    const { data: row, error: qErr } = await admin
      .from("user_nfc_rings")
      .select("id, user_id")
      .eq("nfc_uid_hash", uidHash)
      .eq("is_active", true)
      .maybeSingle();

    if (qErr || !row?.user_id) {
      return NextResponse.json(
        { error: "Unknown or inactive ring." },
        { status: 401 }
      );
    }

    await admin
      .from("user_nfc_rings")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", row.id);

    let email: string | null = null;
    try {
      const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
      email = userData.user?.email ?? null;
    } catch {
      // continue without email claim
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
      return NextResponse.json(
        {
          error: "NFC login JWT is not configured.",
          code: "nfc_login_unconfigured",
          hint: "Set SUPABASE_JWT_SECRET (Dashboard → Settings → API → JWT Secret) or use hub token OAuth flow.",
        },
        { status: 503 }
      );
    }

    const access_token = signSupabaseAccessJwt({
      userId: row.user_id,
      email,
      expiresInSec: accessTtlSec,
    });

    return NextResponse.json({
      access_token,
      token_type: "bearer",
      expires_in: accessTtlSec,
      ring_id: row.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
