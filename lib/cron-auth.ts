import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/** Minimum recommended length for CRON_SECRET (64+ chars in production). */
export const CRON_SECRET_MIN_LENGTH = 32;

export type CronInvokeSource = "vercel" | "external";

export type CronAuthSuccess = {
  authorized: true;
  source: CronInvokeSource;
  auth_method: string;
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

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function normalizeBearerValue(raw: string): string {
  let value = raw.trim();
  while (value.toLowerCase().startsWith("bearer ")) {
    value = value.slice(7).trim();
  }
  return value;
}

/**
 * Accept common external-cron header shapes:
 * - Authorization: Bearer <CRON_SECRET>
 * - Authorization: <CRON_SECRET> (no Bearer prefix)
 * - X-Cron-Secret: <CRON_SECRET> (cron-job.org custom header)
 */
export function extractCronSecretToken(req: NextRequest): {
  token: string;
  method: string;
} {
  const authorization = req.headers.get("authorization")?.trim() || "";
  if (authorization) {
    if (authorization.toLowerCase().startsWith("bearer ")) {
      return {
        token: normalizeBearerValue(authorization),
        method: "authorization_bearer",
      };
    }
    return { token: authorization, method: "authorization_raw" };
  }

  const cronSecret = req.headers.get("x-cron-secret")?.trim();
  if (cronSecret) {
    return { token: cronSecret, method: "x_cron_secret" };
  }

  return { token: "", method: "none" };
}

/**
 * Authorize purge/cron HTTP triggers.
 * - Requires CRON_SECRET via Bearer, raw Authorization, or X-Cron-Secret (32+ chars).
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

  const { token, method } = extractCronSecretToken(req);
  const source = resolveCronInvokeSource(req);
  const clientIp = getClientIp(req);

  if (!token || !secretsMatch(token, secret)) {
    console.warn(
      "[cron-auth] denied",
      JSON.stringify({
        source,
        auth_method: method,
        has_token: Boolean(token),
        client_ip: clientIp || "unknown",
        reason: token ? "token_mismatch" : "missing_token",
      })
    );
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Unauthorized.",
          error_code: "UNAUTHORIZED",
          hint:
            "Set Authorization: Bearer <CRON_SECRET> or X-Cron-Secret: <CRON_SECRET> in cron-job.org Advanced headers. Value must match Vercel CRON_SECRET exactly.",
        },
        { status: 401 }
      ),
    };
  }

  const allowedIps = parseAllowedCronIps();
  if (allowedIps.length > 0 && !isVercelCronRequest(req)) {
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
    source,
    auth_method: method,
  };
}
