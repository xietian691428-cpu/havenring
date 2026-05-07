import { randomUUID, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";
import { hashNfcUid, normalizeNfcUidInput } from "@/lib/nfc-uid";
import { getSupabaseAdminClient, requireAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SdmScene = "new_ring_binding" | "daily_access" | "seal_confirmation";

type ResolveBody = {
  uid?: unknown;
  ctr?: unknown;
  cmac?: unknown;
  picc?: unknown;
  picc_data?: unknown;
  context?: unknown;
  draft_ids?: unknown;
};

type SdmVerification = {
  uid: string;
  counter: number | null;
};

type BoundRing = {
  id: string;
  user_id: string;
  last_used_at: string | null;
  is_active: boolean;
  last_sdm_counter: number | null;
};

function cleanParam(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function getSdmBackendBaseUrl() {
  return (
    process.env.SDM_BACKEND_URL ||
    process.env.SDM_BACKEND_BASE_URL ||
    "http://127.0.0.1:5000"
  ).replace(/\/+$/, "");
}

function getSdmVerifyPath(body: ResolveBody) {
  const configured = process.env.SDM_BACKEND_VERIFY_PATH?.trim();
  if (configured) return configured.startsWith("/") ? configured : `/${configured}`;
  return cleanParam(body.picc) || cleanParam(body.picc_data) ? "/api/tag" : "/api/tagpt";
}

function getReadCounter(payload: Record<string, unknown>) {
  const raw = payload.read_ctr ?? payload.ctr ?? payload.counter;
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) ? value : null;
}

function isClientInputError(message: string) {
  return message === "MISSING_SDM_PARAMS" || message === "MISSING_CMAC";
}

function sealTicketTtlMs() {
  const raw = process.env.NFC_SEAL_TICKET_TTL_SECONDS;
  const fallbackMs = 5 * 60 * 1000;
  if (!raw) return fallbackMs;
  const sec = Number.parseInt(raw, 10);
  if (!Number.isFinite(sec) || sec < 60) return fallbackMs;
  return Math.min(sec, 15 * 60) * 1000;
}

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

function parseDraftIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => String(row || "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function verifySdmPayload(body: ResolveBody): Promise<SdmVerification> {
  const cmac = cleanParam(body.cmac);
  if (!cmac) throw new Error("MISSING_CMAC");

  const url = new URL(`${getSdmBackendBaseUrl()}${getSdmVerifyPath(body)}`);
  const picc = cleanParam(body.picc) || cleanParam(body.picc_data);
  const uid = cleanParam(body.uid);
  const ctr = cleanParam(body.ctr);

  if (picc) {
    url.searchParams.set("picc_data", picc);
    url.searchParams.set("cmac", cmac);
  } else {
    if (!uid || !ctr) throw new Error("MISSING_SDM_PARAMS");
    url.searchParams.set("uid", uid);
    url.searchParams.set("ctr", ctr);
    url.searchParams.set("cmac", cmac);
  }

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const backendError = typeof payload.error === "string" ? payload.error.trim() : "";
  if (!res.ok || backendError) {
    throw new Error(
      backendError || res.statusText || "SDM_VERIFY_FAILED"
    );
  }

  const verifiedUid = normalizeNfcUidInput(String(payload.uid || uid || ""));
  if (!verifiedUid) throw new Error("SDM_UID_MISSING");

  return {
    uid: verifiedUid,
    counter: getReadCounter(payload),
  };
}

async function markRingVerified(ring: BoundRing, counter: number | null) {
  const admin = getSupabaseAdminClient();
  const verifiedAt = new Date().toISOString();
  let query = admin
    .from("user_nfc_rings")
    .update({
      last_used_at: verifiedAt,
      last_sdm_verified_at: verifiedAt,
      sdm_enabled: true,
      ...(counter !== null ? { last_sdm_counter: counter } : {}),
    })
    .eq("id", ring.id)
    .eq("is_active", true);

  if (counter !== null) {
    query = query.or(`last_sdm_counter.is.null,last_sdm_counter.lt.${counter}`);
  }

  const { data, error } = await query.select("id").limit(1);
  if (error) {
    throw new Error("RING_UPDATE_FAILED");
  }
  if (counter !== null && (!data || data.length === 0)) {
    throw new Error("SDM_REPLAY_DETECTED");
  }
}

async function issueSealTicket(opts: {
  userId: string;
  uidHash: string;
  draftIds: string[];
}) {
  if (!opts.draftIds.length) return null;
  const admin = getSupabaseAdminClient();
  const ticket = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + sealTicketTtlMs()).toISOString();
  const { error } = await admin.from("seal_tickets" as never).insert({
    user_id: opts.userId,
    ring_uid_hash: opts.uidHash,
    draft_ids: opts.draftIds,
    ticket_hash: sha256(ticket),
    expires_at: expiresAt,
  } as never);
  if (error) {
    throw new Error("SEAL_TICKET_ISSUE_FAILED");
  }
  return { ticket, expiresAt };
}

export async function POST(req: NextRequest) {
  const limitRes = await enforceIpRateLimit({
    req,
    scope: "sdm-resolve",
    policy: API_RATE_POLICIES.ringMedium,
  });
  if (limitRes) return limitRes;

  try {
    const body = (await req.json()) as ResolveBody;
    const verified = await verifySdmPayload(body);
    const uidHash = hashNfcUid(verified.uid);
    const admin = getSupabaseAdminClient();
    const { data: ring, error } = await admin
      .from("user_nfc_rings")
      .select("id, user_id, last_used_at, is_active, last_sdm_counter")
      .eq("nfc_uid_hash", uidHash)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { valid: false, error: "Ring lookup failed.", code: "RING_LOOKUP_FAILED" },
        { status: 500 }
      );
    }

    if (
      ring &&
      verified.counter !== null &&
      ring.last_sdm_counter !== null &&
      verified.counter <= ring.last_sdm_counter
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "This ring touch was already used.",
          code: "SDM_REPLAY_DETECTED",
        },
        { status: 409 }
      );
    }
    const context = cleanParam(body.context);
    let scene: SdmScene = ring ? "daily_access" : "new_ring_binding";
    let currentUserId = "";

    if (ring && context === "seal_confirmation") {
      try {
        const user = await requireAuthenticatedUser(req);
        currentUserId = user.id;
        scene = user.id === ring.user_id ? "seal_confirmation" : "daily_access";
      } catch {
        scene = "daily_access";
      }
    }

    if (ring) {
      try {
        await markRingVerified(ring, verified.counter);
      } catch (error) {
        const code = error instanceof Error ? error.message : "RING_UPDATE_FAILED";
        return NextResponse.json(
          {
            valid: false,
            error:
              code === "SDM_REPLAY_DETECTED"
                ? "This ring touch was already used."
                : "Ring verification state could not be updated.",
            code,
          },
          { status: code === "SDM_REPLAY_DETECTED" ? 409 : 500 }
        );
      }
    }

    let sealTicket: { ticket: string; expiresAt: string } | null = null;
    if (scene === "seal_confirmation" && currentUserId && ring) {
      try {
        sealTicket = await issueSealTicket({
          userId: currentUserId,
          uidHash,
          draftIds: parseDraftIds(body.draft_ids),
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "SEAL_TICKET_ISSUE_FAILED";
        return NextResponse.json(
          {
            valid: false,
            error: "Ring was verified, but the seal ticket could not be issued.",
            code,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      valid: true,
      uid: verified.uid,
      counter: verified.counter,
      scene,
      ringId: ring?.id ?? null,
      ownerId: ring?.user_id ?? null,
      currentUserId: currentUserId || null,
      sealTicket: sealTicket?.ticket ?? null,
      sealTicketExpiresAt: sealTicket?.expiresAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return NextResponse.json(
      { valid: false, error: message, code: message },
      { status: isClientInputError(message) ? 400 : 502 }
    );
  }
}
