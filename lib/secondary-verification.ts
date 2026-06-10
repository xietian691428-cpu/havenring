import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const TOKEN_TTL_MS = 2 * 60 * 1000;

type StoredToken = {
  userId: string;
  expiresAt: number;
};

const memoryTokens = new Map<string, StoredToken>();

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function redisConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function redisAuthHeaders() {
  return {
    Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
  };
}

function redisKey(tokenHash: string) {
  return `secver:${tokenHash}`;
}

async function redisSetToken(tokenHash: string, userId: string) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const ttlSec = Math.ceil(TOKEN_TTL_MS / 1000);
  await fetch(`${redisUrl}/set/${redisKey(tokenHash)}/${userId}/EX/${ttlSec}`, {
    method: "POST",
    headers: redisAuthHeaders(),
  });
}

async function redisConsumeToken(
  tokenHash: string,
  userId: string
): Promise<boolean> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL!;
  const res = await fetch(`${redisUrl}/getdel/${redisKey(tokenHash)}`, {
    method: "POST",
    headers: redisAuthHeaders(),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { result?: string | null };
  return json.result === userId;
}

function pruneExpiredMemoryTokens() {
  const now = Date.now();
  for (const [key, entry] of memoryTokens) {
    if (entry.expiresAt <= now) {
      memoryTokens.delete(key);
    }
  }
}

export async function mintSecondaryVerificationToken(
  userId: string
): Promise<{ token: string; expiresInSec: number }> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresInSec = Math.ceil(TOKEN_TTL_MS / 1000);

  if (redisConfigured()) {
    try {
      await redisSetToken(tokenHash, userId);
      return { token, expiresInSec };
    } catch {
      // Fall through to in-memory store.
    }
  }

  pruneExpiredMemoryTokens();
  memoryTokens.set(tokenHash, {
    userId,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return { token, expiresInSec };
}

export async function consumeSecondaryVerificationToken(
  userId: string,
  token: string
): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;

  const tokenHash = hashToken(trimmed);

  if (redisConfigured()) {
    try {
      return await redisConsumeToken(tokenHash, userId);
    } catch {
      // Fall through to in-memory store.
    }
  }

  pruneExpiredMemoryTokens();
  const entry = memoryTokens.get(tokenHash);
  if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
    return false;
  }
  memoryTokens.delete(tokenHash);
  return true;
}

export async function requireSecondaryVerificationToken(
  req: NextRequest,
  userId: string
): Promise<NextResponse | null> {
  const legacy = req.headers.get("x-haven-secondary-verified");
  if (legacy === "1") {
    return NextResponse.json(
      {
        error: "Secondary verification token required.",
        code: "secondary_verification_required",
        hint: "Request a short-lived token from POST /api/auth/secondary-token after device verification.",
      },
      { status: 403 }
    );
  }

  const token = req.headers.get("x-haven-secondary-token")?.trim();
  if (!token) {
    return NextResponse.json(
      {
        error: "Secondary verification required.",
        code: "secondary_verification_required",
        hint: "Complete device verification, then request a secondary token.",
      },
      { status: 403 }
    );
  }

  const valid = await consumeSecondaryVerificationToken(userId, token);
  if (!valid) {
    return NextResponse.json(
      {
        error: "Invalid or expired secondary verification token.",
        code: "secondary_verification_invalid",
      },
      { status: 403 }
    );
  }

  return null;
}
