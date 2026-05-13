import { SITE_ORIGIN } from "@/lib/site";

/** Production OAuth / magic-link host (no www). */
export const PRODUCTION_AUTH_ORIGIN = "https://havenring.me";

/**
 * Single origin for Supabase `redirectTo` on havenring production.
 * Always use apex so OAuth never lands on `www` (server/CDN www→apex redirects
 * strip URL fragments and break `#access_token=...` recovery).
 */
export function canonicalAuthOriginFromLocation(): string {
  if (typeof window === "undefined") {
    return SITE_ORIGIN.replace(/\/$/, "");
  }
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    return window.location.origin.replace(/\/$/, "");
  }
  if (host === "havenring.me" || host === "www.havenring.me") {
    return PRODUCTION_AUTH_ORIGIN;
  }
  return window.location.origin.replace(/\/$/, "");
}
