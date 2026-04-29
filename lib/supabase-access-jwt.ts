import { createHmac } from "node:crypto";

/**
 * Signs a Supabase-compatible HS256 JWT using the project's JWT secret
 * (Dashboard → Settings → API → JWT Secret). Same secret verifies sessions.
 *
 * Includes `iss` when derivable from `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
 * (typically `https://<project-ref>.supabase.co/auth/v1`) so GoTrue-style validators accept the token.
 * Override with `SUPABASE_JWT_ISS` if your project uses a custom issuer.
 *
 * Used by `/api/auth/nfc-login` for ring-based session bootstrap when enabled.
 * Set `SUPABASE_JWT_SECRET` in the server environment.
 */

/** Issuer claim matching Supabase Auth (JWT issuer URL). */
export function resolveSupabaseJwtIssuer(): string | undefined {
  const explicit = process.env.SUPABASE_JWT_ISS?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const raw =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return `${u.origin}/auth/v1`;
  } catch {
    return undefined;
  }
}

function base64UrlEncodeJson(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signSupabaseAccessJwt(params: {
  userId: string;
  email?: string | null;
  expiresInSec: number;
}): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret || typeof secret !== "string") {
    throw new Error("SUPABASE_JWT_SECRET is not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const iss = resolveSupabaseJwtIssuer();
  const payload: Record<string, unknown> = {
    aud: "authenticated",
    exp: now + params.expiresInSec,
    iat: now,
    sub: params.userId,
    role: "authenticated",
    email: params.email ?? "",
    app_metadata: {},
    user_metadata: {},
  };
  if (iss) {
    payload.iss = iss;
  }

  const headerPart = base64UrlEncodeJson(header as unknown as Record<string, unknown>);
  const payloadPart = base64UrlEncodeJson(payload);
  const data = `${headerPart}.${payloadPart}`;
  const sig = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}
