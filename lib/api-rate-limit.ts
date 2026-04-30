import { NextRequest, NextResponse } from "next/server";
import { hitRateLimitWithRedisFallback } from "@/lib/rate-limit";

export const API_RATE_POLICIES = {
  sealFinalize: { maxRequests: 10, windowMs: 60_000 },
  sealRingTap: { maxRequests: 45, windowMs: 60_000 },
  ringMedium: { maxRequests: 45, windowMs: 60_000 },
} as const;

type RatePolicy = {
  maxRequests: number;
  windowMs: number;
};

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const first = forwarded.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

function buildKey(scope: string, userId: string, ip: string) {
  return `${scope}:u:${userId || "anon"}:ip:${ip || "unknown"}`;
}

export async function enforceUserIpRateLimit(opts: {
  req: NextRequest;
  userId: string;
  scope: string;
  policy: RatePolicy;
}) {
  const ip = getClientIp(opts.req);
  const key = buildKey(opts.scope, opts.userId, ip);
  const hit = await hitRateLimitWithRedisFallback(
    key,
    opts.policy.maxRequests,
    opts.policy.windowMs
  );
  if (hit.allowed) {
    return null;
  }
  return NextResponse.json(
    {
      error: "Too many requests. Please try again shortly.",
      error_code: "RATE_LIMITED",
      retry_after_ms: Math.max(0, hit.retryAfterMs || 0),
    },
    { status: 429 }
  );
}

export async function enforceIpRateLimit(opts: {
  req: NextRequest;
  scope: string;
  policy: RatePolicy;
}) {
  const ip = getClientIp(opts.req);
  const key = buildKey(opts.scope, "anonymous", ip);
  const hit = await hitRateLimitWithRedisFallback(
    key,
    opts.policy.maxRequests,
    opts.policy.windowMs
  );
  if (hit.allowed) {
    return null;
  }
  return NextResponse.json(
    {
      error: "Too many requests. Please try again shortly.",
      error_code: "RATE_LIMITED",
      retry_after_ms: Math.max(0, hit.retryAfterMs || 0),
    },
    { status: 429 }
  );
}
