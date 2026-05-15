import { SITE_ORIGIN as canonicalOrigin } from "@/lib/site";

/**
 * Secondary purchase path — replace with your Amazon PDP when the ASIN is live.
 * Example: https://www.amazon.com/dp/B0XXXXXXXX
 */
export const AMAZON_RITUAL_RING_URL =
  process.env.NEXT_PUBLIC_AMAZON_RITUAL_RING_URL ?? "https://www.amazon.com/dp/PLACEHOLDER";

export const SITE_ORIGIN = canonicalOrigin;

export const WAITLIST_MAILTO =
  "mailto:hello@havenring.me?subject=HavenRing%20waitlist";
