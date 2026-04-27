import { createClient, type User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getEnvOrThrow(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`[haven-ring] Missing required env var: ${name}`);
  }
  return value;
}

export function getSupabaseAdminClient() {
  return createClient<Database>(
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function getSupabaseAnonClient(authHeader: string) {
  return createClient<Database>(
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey),
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export function getSupabaseUserClient(accessToken: string) {
  const authHeader = `Bearer ${accessToken}`;
  return getSupabaseAnonClient(authHeader);
}

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer") return null;
  if (!token) return null;
  return token;
}

export async function requireAuthenticatedUser(req: NextRequest): Promise<User> {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }

  const authHeader = `Bearer ${token}`;
  const anon = getSupabaseAnonClient(authHeader);
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) {
    throw new Error("UNAUTHENTICATED");
  }
  return data.user;
}

export function isAnonymousUser(user: User): boolean {
  const provider = user.app_metadata?.provider;
  const anonymousFlag = (user as User & { is_anonymous?: boolean }).is_anonymous;
  return provider === "anonymous" || anonymousFlag === true;
}

export function requireBearerToken(req: NextRequest): string {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }
  return token;
}
