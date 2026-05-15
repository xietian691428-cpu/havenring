import type { Metadata } from "next";
import { MarketingLoginClient } from "./MarketingLoginClient";

export const metadata: Metadata = {
  title: "Website sign-in — HavenRing",
  description:
    "Sign in to the HavenRing brand site for orders and updates. The private memory app opens separately at /app.",
  robots: { index: false, follow: true },
};

export default function MarketingLoginPage() {
  return <MarketingLoginClient />;
}
