import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { purgeExpiredSealStaging } from "@/lib/seal-staging-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Purges expired seal_staging rows + Storage blobs.
 * - Hobby: Vercel runs daily at 04:00 UTC (safety net).
 * - Primary: external scheduler every 5 min (cron-job.org) with Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = authorizeCronRequest(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const startedAt = Date.now();
  try {
    const result = await purgeExpiredSealStaging({ source: auth.source });
    return NextResponse.json({
      ok: true,
      source: auth.source,
      schedule:
        auth.source === "vercel"
          ? req.headers.get("x-vercel-cron-schedule") || "0 4 * * *"
          : "external",
      ...result,
      route_latency_ms: Date.now() - startedAt,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "PURGE_FAILED", source: auth.source },
      { status: 500 }
    );
  }
}
