import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// The anon key is safe to ship to the browser — it is gated by Row Level
// Security policies in `docs/database-schema.md`. We still fail loudly if it
// is missing, rather than silently running against a phantom backend.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Do not throw at module-eval time in the browser, because that would
  // take down the whole shell. Log once and let call sites handle it.
  // In development this is the most common fix.
  if (typeof window !== "undefined") {
    console.warn(
      "[haven-ring] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. See .env.example."
    );
  }
}

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(
    supabaseUrl ?? "http://invalid.local",
    supabaseAnonKey ?? "invalid",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Moments are keyed to the device's local crypto key. Clearing
        // storage == losing access == by design.
        storageKey: "haven.auth",
      },
    }
  );
  return browserClient;
}

// Server-side client for Server Components / Route Handlers. We use the anon
// key here too — the RLS policies are the only trusted boundary. Do NOT
// import this from client components.
export function getSupabaseServerClient(): SupabaseClient<Database> {
  return createClient<Database>(
    supabaseUrl ?? "http://invalid.local",
    supabaseAnonKey ?? "invalid",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
