import { NextRequest, NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { purgeExpiredSealStaging } from "@/lib/seal-staging-server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Every 5 minutes via Vercel Cron — deletes expired seal_staging rows + storage blobs. */
export async function GET(req: NextRequest) {
  const denied = authorizeCronRequest(req);
  if (denied) return denied;

  try {
    const result = await purgeExpiredSealStaging();
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      { ok: false, error_code: "PURGE_FAILED" },
      { status: 500 }
    );
  }
}
