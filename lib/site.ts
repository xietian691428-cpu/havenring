/**
 * Canonical public URL for SEO (sitemap, metadata, OG). Production: havenring.me.
 * Override in preview/staging with NEXT_PUBLIC_SITE_URL if needed.
 */
export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://havenring.me"
);

/**
 * Next.js route that mounts the in-app shell (Supabase session, ring flows).
 * OAuth callbacks and deep links with query params must use this path — not `/`,
 * which is the marketing landing page.
 */
export const APP_ENTRY_PATH = "/app" as const;

/** Website account sign-in (orders, waitlist, sharing) — separate UX from `/start` + `/app`. */
export const MARKETING_LOGIN_PATH = "/login" as const;

/** Client: full URL to the app shell entry on the current origin. */
export function appEntryUrl(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${APP_ENTRY_PATH}`;
}
