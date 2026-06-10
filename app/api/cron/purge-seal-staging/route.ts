import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { purgeExpiredSealStaging } from "@/lib/seal-staging-server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function runPurge(req: NextRequest) {
  const auth = authorizeCronRequest(req);
  if (!auth.authorized) {
    return auth.response;
  }

  const startedAt = Date.now();
  const schedule =
    auth.source === "vercel"
      ? req.headers.get("x-vercel-cron-schedule") || "0 4 * * *"
      : "external";

  try {
    const result = await purgeExpiredSealStaging({ source: auth.source });
    const payload = {
      ok: true as const,
      source: auth.source,
      auth_method: auth.auth_method,
      schedule,
      ...result,
      route_latency_ms: Date.now() - startedAt,
    };
    console.info("[purge-seal-staging] success", JSON.stringify(payload));
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PURGE_FAILED";
    console.error(
      "[purge-seal-staging] failed",
      JSON.stringify({
        source: auth.source,
        auth_method: auth.auth_method,
        schedule,
        error: message,
        route_latency_ms: Date.now() - startedAt,
      })
    );
    return NextResponse.json(
      {
        ok: false,
        error_code: "PURGE_FAILED",
        source: auth.source,
        schedule,
      },
      { status: 500 }
    );
  }
}

/**
 * Purges expired seal_staging rows + Storage blobs.
 * - Hobby: Vercel runs daily at 04:00 UTC (safety net).
 * - Primary: external scheduler every 5 min (cron-job.org) with Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  return runPurge(req);
}

/** cron-job.org can be configured for POST; same auth contract as GET. */
export async function POST(req: NextRequest) {
  return runPurge(req);
}
