import { SITE_ORIGIN } from "@/lib/site";

/**
 * Origin for Supabase `redirectTo` and magic-link returns.
 *
 * On the production hostnames we normalize to `NEXT_PUBLIC_SITE_URL` (defaults
 * to apex `https://havenring.me`) so OAuth does not rely on edge `www`→apex
 * HTTP redirects that drop `#access_token=…`. Android Chrome, Samsung
 * Internet, and in-app browsers use the same `window.location.origin` rules as
 * desktop once TLS and hostname match.
 *
 * Use the **live** `window.location.origin` when the page is clearly not public
 * TLS on :443 (e.g. `http://havenring.me:3000` with hosts-file mapping, or
 * HTTPS on a dev port). Otherwise `redirectTo` would point at production and
 * the IdP could never round-trip to the dev server.
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
    if (window.location.protocol !== "https:") {
      return window.location.origin.replace(/\/$/, "");
    }
    const port = window.location.port;
    if (port && port !== "443") {
      return window.location.origin.replace(/\/$/, "");
    }
    return SITE_ORIGIN.replace(/\/$/, "");
  }
  return window.location.origin.replace(/\/$/, "");
}
