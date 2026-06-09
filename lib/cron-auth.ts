import { NextRequest, NextResponse } from "next/server";

export function authorizeCronRequest(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Cron not configured.", error_code: "CRON_NOT_CONFIGURED" },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== secret) {
    return NextResponse.json(
      { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  return null;
}
