import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  requireAuthenticatedUser,
  requireBearerToken,
} from "@/lib/supabase/server";
import { API_RATE_POLICIES, enforceUserIpRateLimit } from "@/lib/api-rate-limit";
import { hashSealTicketSecret, MAX_SEAL_DRAFT_IDS, parseSealDraftIdsSorted } from "@/lib/seal-shared";
import { recordSealTelemetry } from "@/lib/sealTelemetry";

type FinalizeBody = {
  seal_ticket?: unknown;
  draft_ids?: unknown;
  mode?: unknown;
  draft_payloads?: unknown;
};

type DraftPayload = {
  id: string;
  title: string;
  story: string;
  photo: unknown[];
  attachments: unknown[];
  releaseAt: number;
};

type SealTicketRow = {
  id: string;
  draft_ids: unknown;
  ring_uid_hash: string | null;
  expires_at: string | null;
  consumed_at: string | null;
};

type SealFinalizeAtomicResult = {
  saved_ids?: unknown;
  sealed_by_ring_uid?: string | null;
  consumed_at?: string | null;
};

function parseDraftPayloads(input: unknown): DraftPayload[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const obj = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        id: String(obj.id || "").trim(),
        title: String(obj.title || "").trim(),
        story: String(obj.story || ""),
        photo: Array.isArray(obj.photo) ? obj.photo : [],
        attachments: Array.isArray(obj.attachments) ? obj.attachments : [],
        releaseAt: Number(obj.releaseAt || 0) || 0,
      };
    })
    .filter((row) => row.id)
    .slice(0, MAX_SEAL_DRAFT_IDS);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  try {
    requireBearerToken(req);
    const user = await requireAuthenticatedUser(req);
    const body = (await req.json()) as FinalizeBody;
    const ticket = typeof body.seal_ticket === "string" ? body.seal_ticket.trim() : "";
    const draftIds = parseSealDraftIdsSorted(body.draft_ids);
    const mode = typeof body.mode === "string" ? body.mode : "precheck";
    const draftPayloads = parseDraftPayloads(body.draft_payloads);
    const limitRes = await enforceUserIpRateLimit({
      req,
      userId: user.id,
      scope: "seal-finalize",
      policy: mode === "commit" ? API_RATE_POLICIES.sealFinalize : API_RATE_POLICIES.ringMedium,
    });
    if (limitRes) return limitRes;
    if (!["precheck", "commit"].includes(mode)) {
      await recordSealTelemetry(null, {
        endpoint: "finalize",
        phase: "request",
        outcome: "error",
        mode,
        error_code: "INVALID_FINALIZE_MODE",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Invalid finalize mode.", error_code: "INVALID_FINALIZE_MODE" },
        { status: 400 }
      );
    }
    if (!ticket || !draftIds.length) {
      await recordSealTelemetry(null, {
        endpoint: "finalize",
        phase: "request",
        outcome: "error",
        mode,
        error_code: "MISSING_SEAL_DATA",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Missing seal data.", error_code: "MISSING_SEAL_DATA" },
        { status: 400 }
      );
    }

    const ticketHash = hashSealTicketSecret(ticket);
    const admin = getSupabaseAdminClient();
    const { data: ticketRow, error: findErr } = await admin
      .from("seal_tickets" as never)
      .select("id, draft_ids, ring_uid_hash, expires_at, consumed_at")
      .eq("ticket_hash", ticketHash)
      .eq("user_id", user.id)
      .maybeSingle();
    const row = (ticketRow as SealTicketRow | null) ?? null;
    if (findErr) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: mode === "commit" ? "commit" : "precheck",
        outcome: "error",
        mode,
        error_code: "TICKET_VERIFY_FAILED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Could not verify ticket.", error_code: "TICKET_VERIFY_FAILED" },
        { status: 500 }
      );
    }
    if (!row) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: mode === "commit" ? "commit" : "precheck",
        outcome: "error",
        mode,
        error_code: "INVALID_TICKET",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Invalid ticket.", error_code: "INVALID_TICKET" },
        { status: 404 }
      );
    }
    if (row.consumed_at) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: mode === "commit" ? "commit" : "precheck",
        outcome: "error",
        mode,
        error_code: "TICKET_ALREADY_USED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Ticket already used.", error_code: "TICKET_ALREADY_USED" },
        { status: 409 }
      );
    }
    if (Date.parse(String(row.expires_at || "")) <= Date.now()) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: mode === "commit" ? "commit" : "precheck",
        outcome: "error",
        mode,
        error_code: "TICKET_EXPIRED",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Ticket expired.", error_code: "TICKET_EXPIRED" },
        { status: 410 }
      );
    }

    const expected = parseSealDraftIdsSorted(row.draft_ids);
    if (JSON.stringify(expected) !== JSON.stringify(draftIds)) {
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: mode === "commit" ? "commit" : "precheck",
        outcome: "error",
        mode,
        error_code: "DRAFT_SET_MISMATCH",
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        { error: "Draft set mismatch.", error_code: "DRAFT_SET_MISMATCH" },
        { status: 409 }
      );
    }

    if (mode === "commit") {
      if (draftPayloads.length !== draftIds.length) {
        await recordSealTelemetry(admin, {
          user_id: user.id,
          endpoint: "finalize",
          phase: "commit",
          outcome: "error",
          mode,
          error_code: "MISSING_DRAFT_PAYLOADS",
          latency_ms: Date.now() - startedAt,
        });
        return NextResponse.json(
          { error: "Missing draft payloads.", error_code: "MISSING_DRAFT_PAYLOADS" },
          { status: 400 }
        );
      }
      const payloadIds = [...draftPayloads.map((item) => item.id)].sort();
      if (JSON.stringify(payloadIds) !== JSON.stringify(draftIds)) {
        await recordSealTelemetry(admin, {
          user_id: user.id,
          endpoint: "finalize",
          phase: "commit",
          outcome: "error",
          mode,
          error_code: "DRAFT_PAYLOAD_MISMATCH",
          latency_ms: Date.now() - startedAt,
        });
        return NextResponse.json(
          { error: "Draft payload mismatch.", error_code: "DRAFT_PAYLOAD_MISMATCH" },
          { status: 409 }
        );
      }
      const { data: rpcData, error: rpcErr } = await admin.rpc(
        "seal_finalize_atomic" as never,
        {
          p_user_id: user.id,
          p_ticket_hash: ticketHash,
          p_draft_ids: draftIds,
          p_draft_payloads: draftPayloads,
        } as never
      );
      if (rpcErr) {
        const msg = String(rpcErr.message || "");
        if (msg.includes("ticket_expired")) {
          await recordSealTelemetry(admin, {
            user_id: user.id,
            endpoint: "finalize",
            phase: "commit",
            outcome: "error",
            mode,
            error_code: "TICKET_EXPIRED",
            latency_ms: Date.now() - startedAt,
          });
          return NextResponse.json(
            { error: "Ticket expired.", error_code: "TICKET_EXPIRED" },
            { status: 410 }
          );
        }
        if (msg.includes("ticket_already_used")) {
          await recordSealTelemetry(admin, {
            user_id: user.id,
            endpoint: "finalize",
            phase: "commit",
            outcome: "error",
            mode,
            error_code: "TICKET_ALREADY_USED",
            latency_ms: Date.now() - startedAt,
          });
          return NextResponse.json(
            { error: "Ticket already used.", error_code: "TICKET_ALREADY_USED" },
            { status: 409 }
          );
        }
        if (
          msg.includes("draft_set_mismatch") ||
          msg.includes("draft_payload_mismatch") ||
          msg.includes("no_active_ring")
        ) {
          await recordSealTelemetry(admin, {
            user_id: user.id,
            endpoint: "finalize",
            phase: "commit",
            outcome: "error",
            mode,
            error_code: "SEAL_COMMIT_REJECTED",
            latency_ms: Date.now() - startedAt,
          });
          return NextResponse.json(
            { error: "Seal commit rejected.", error_code: "SEAL_COMMIT_REJECTED" },
            { status: 409 }
          );
        }
        await recordSealTelemetry(admin, {
          user_id: user.id,
          endpoint: "finalize",
          phase: "commit",
          outcome: "error",
          mode,
          error_code: "SEAL_COMMIT_FAILED",
          latency_ms: Date.now() - startedAt,
        });
        return NextResponse.json(
          { error: "Failed to commit seal.", error_code: "SEAL_COMMIT_FAILED" },
          { status: 500 }
        );
      }
      const firstRow = (
        Array.isArray(rpcData) ? rpcData[0] : rpcData
      ) as SealFinalizeAtomicResult | null;
      await recordSealTelemetry(admin, {
        user_id: user.id,
        endpoint: "finalize",
        phase: "commit",
        outcome: "success",
        mode,
        latency_ms: Date.now() - startedAt,
      });
      return NextResponse.json(
        {
          ok: true,
          mode,
          retry_until: row.expires_at,
          sealed_by_ring_uid:
            typeof firstRow?.sealed_by_ring_uid === "string"
              ? firstRow.sealed_by_ring_uid
              : row.ring_uid_hash || "",
          saved_ids: draftIds,
        },
        { status: 200 }
      );
    }

    await recordSealTelemetry(admin, {
      user_id: user.id,
      endpoint: "finalize",
      phase: "precheck",
      outcome: "success",
      mode,
      latency_ms: Date.now() - startedAt,
    });
    return NextResponse.json(
      {
        ok: true,
        mode,
        retry_until: row.expires_at,
        sealed_by_ring_uid: row.ring_uid_hash || "",
        saved_ids: mode === "commit" ? draftIds : [],
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      await recordSealTelemetry(null, {
        endpoint: "finalize",
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
      endpoint: "finalize",
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

