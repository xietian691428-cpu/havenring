import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import {
  hashSealTicketSecret,
  parseSealDraftIds,
  sealTicketExpiryMs,
} from "@/lib/seal-shared";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import { recordSealTelemetry } from "@/lib/sealTelemetry";

type RingTapBody = {
  nfc_uid?: unknown;
  draft_ids?: unknown;
};

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "seal-ring-tap",
      policy: API_RATE_POLICIES.sealRingTap,
    });
    if (limitRes) return limitRes;
    const body = (await req.json()) as RingTapBody;
    const rawUid = typeof body.nfc_uid === "string" ? body.nfc_uid : "";
    const normalizedUid = normalizeNfcUidInput(rawUid);
    if (!normalizedUid) {
      await recordSealTelemetry(null, {
        endpoint: "ring_tap",
        phase: "request",
        outcome: "error",
        error_code: "INVALID_NFC_UID",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Invalid nfc_uid.", error_code: "INVALID_NFC_UID" },
        { status: 400 }
      );
    }
    const draftIds = parseSealDraftIds(body.draft_ids);
    if (!draftIds.length) {
      await recordSealTelemetry(null, {
        endpoint: "ring_tap",
        phase: "request",
        outcome: "error",
        error_code: "MISSING_DRAFT_IDS",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Missing draft_ids.", error_code: "MISSING_DRAFT_IDS" },
        { status: 400 }
      );
    }

    const uidHash = hashNfcUid(normalizedUid);
    const admin = getSupabaseAdminClient();
    const { data: boundRing, error: boundErr } = await admin
      .from("user_nfc_rings")
      .select("id, nfc_uid_hash")
      .eq("user_id", user.id)
      .eq("nfc_uid_hash", uidHash)
      .eq("is_active", true)
      .maybeSingle();
    if (boundErr) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "ring_tap",
        phase: "request",
        outcome: "error",
        error_code: "RING_VERIFY_FAILED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Could not verify ring.", error_code: "RING_VERIFY_FAILED" },
        { status: 500 }
      );
    }
    if (!boundRing) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "ring_tap",
        phase: "request",
        outcome: "error",
        error_code: "RING_NOT_LINKED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          error: "This ring is not linked to your account.",
          error_code: "RING_NOT_LINKED",
        },
        { status: 404 }
      );
    }

    const ticket = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const ticketHash = hashSealTicketSecret(ticket);
    const expiresAt = new Date(Date.now() + sealTicketExpiryMs()).toISOString();
    const { error: insertErr } = await admin.from("seal_tickets" as never).insert({
      user_id: user.id,
      ring_uid_hash: uidHash,
      draft_ids: draftIds,
      ticket_hash: ticketHash,
      expires_at: expiresAt,
    } as never);
    if (insertErr) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "ring_tap",
        phase: "issue_ticket",
        outcome: "error",
        error_code: "TICKET_ISSUE_FAILED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Failed to issue seal ticket.", error_code: "TICKET_ISSUE_FAILED" },
        { status: 500 }
      );
    }

    await recordSealTelemetry(admin, {
      user_id: user.id,
      endpoint: "ring_tap",
      phase: "issue_ticket",
      outcome: "success",
      latency_ms: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        seal_ticket: ticket,
        expires_at: expiresAt,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      await recordSealTelemetry(null, {
        endpoint: "ring_tap",
        phase: "request",
        outcome: "error",
        error_code: "UNAUTHORIZED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    await recordSealTelemetry(null, {
      endpoint: "ring_tap",
      phase: "request",
      outcome: "error",
      error_code: "UNEXPECTED_ERROR",
      latency_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Unexpected error.", error_code: "UNEXPECTED_ERROR" },
      { status: 500 }
    );
  }
}

