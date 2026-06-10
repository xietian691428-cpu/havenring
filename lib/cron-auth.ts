import { NextRequest, NextResponse } from "next/server";

/** Minimum recommended length for CRON_SECRET (64+ chars in production). */
export const CRON_SECRET_MIN_LENGTH = 32;

export type CronInvokeSource = "vercel" | "external";

export type CronAuthSuccess = {
  authorized: true;
  source: CronInvokeSource;
};

export type CronAuthFailure = {
  authorized: false;
  response: NextResponse;
};

export type CronAuthResult = CronAuthSuccess | CronAuthFailure;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "";
}

function parseAllowedCronIps(): string[] {
  const raw = process.env.CRON_ALLOWED_IPS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Vercel Cron uses user-agent `vercel-cron/1.0` and `x-vercel-cron-schedule`. */
export function resolveCronInvokeSource(req: NextRequest): CronInvokeSource {
  const userAgent = req.headers.get("user-agent") || "";
  if (userAgent.includes("vercel-cron")) {
    return "vercel";
  }
  return "external";
}

function isVercelCronRequest(req: NextRequest): boolean {
  return resolveCronInvokeSource(req) === "vercel";
}

/**
 * Authorize purge/cron HTTP triggers.
 * - Requires Bearer CRON_SECRET (32+ chars).
 * - Optional CRON_ALLOWED_IPS: comma-separated; skipped for Vercel Cron (vercel-cron UA).
 * - External schedulers (e.g. cron-job.org) rely on the secret; add IPs when stable.
 */
export function authorizeCronRequest(req: NextRequest): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Cron not configured.", error_code: "CRON_NOT_CONFIGURED" },
        { status: 503 }
      ),
    };
  }

  if (secret.length < CRON_SECRET_MIN_LENGTH) {
    console.error(
      `[cron-auth] CRON_SECRET must be at least ${CRON_SECRET_MIN_LENGTH} characters.`
    );
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Cron not configured.", error_code: "CRON_SECRET_TOO_SHORT" },
        { status: 503 }
      ),
    };
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== secret) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Unauthorized.", error_code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const allowedIps = parseAllowedCronIps();
  if (allowedIps.length > 0 && !isVercelCronRequest(req)) {
    const clientIp = getClientIp(req);
    if (!clientIp || !allowedIps.includes(clientIp)) {
      console.warn("[cron-auth] External cron IP denied:", clientIp || "unknown");
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Forbidden.", error_code: "CRON_IP_DENIED" },
          { status: 403 }
        ),
      };
    }
  }

  return {
    authorized: true,
    source: resolveCronInvokeSource(req),
  };
}
