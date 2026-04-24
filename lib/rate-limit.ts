type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-memory limiter for single-instance deployments.
 * For multi-region production, move this to Redis/Upstash.
 */
export function hitRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export async function hitRateLimitWithRedisFallback(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return hitRateLimit(key, maxRequests, windowMs);
  }

  const now = Date.now();
  const windowBucket = Math.floor(now / windowMs);
  const redisKey = `rl:${key}:${windowBucket}`;

  try {
    const incrResponse = await fetch(`${redisUrl}/incr/${redisKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    });
    if (!incrResponse.ok) {
      return hitRateLimit(key, maxRequests, windowMs);
    }
    const incrJson = (await incrResponse.json()) as { result?: number };
    const count = typeof incrJson.result === "number" ? incrJson.result : 1;

    if (count === 1) {
      await fetch(`${redisUrl}/expire/${redisKey}/${Math.ceil(windowMs / 1000)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
        },
      }).catch(() => {});
    }

    if (count > maxRequests) {
      const nextReset = (windowBucket + 1) * windowMs;
      return { allowed: false, retryAfterMs: Math.max(0, nextReset - now) };
    }
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return hitRateLimit(key, maxRequests, windowMs);
  }
}
