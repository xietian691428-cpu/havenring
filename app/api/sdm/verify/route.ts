/**
 * @fileoverview LEGACY — compatibility-only SDM endpoint.
 *
 * Canonical NFC/SDM verification: `POST /api/rings/sdm/resolve`.
 * This route forwards the request body to resolve and returns the same JSON.
 * Do not add new product logic here.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type LegacyVerifyBody = {
  picc_data?: unknown;
  picc?: unknown;
  cmac?: unknown;
  uid?: unknown;
  ctr?: unknown;
  context?: unknown;
  draft_ids?: unknown;
};

/**
 * Backward-compatible SDM endpoint.
 *
 * The canonical verifier is /api/rings/sdm/resolve. Keep this route only for
 * older ring URLs or clients that still POST to /api/sdm/verify.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LegacyVerifyBody;
    const resolveUrl = new URL("/api/rings/sdm/resolve", request.url);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const authorization = request.headers.get("authorization");
    if (authorization) {
      headers.Authorization = authorization;
    }

    const response = await fetch(resolveUrl, {
      method: "POST",
      headers,
      cache: "no-store",
      body: JSON.stringify({
        ...body,
        picc: body.picc ?? body.picc_data,
        picc_data: body.picc_data ?? body.picc,
      }),
    });

    const payload = await response.json().catch(() => ({
      valid: false,
      error: "SDM resolve returned an invalid response.",
      code: "SDM_RESOLVE_INVALID_RESPONSE",
    }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("Legacy SDM verify compatibility error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error", code: "SDM_VERIFY_COMPAT_FAILED" },
      { status: 500 }
    );
  }
}
