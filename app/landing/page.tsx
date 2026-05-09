import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "HavenRing — Keep what matters.",
  description:
    "A sacred vessel for private moments — not another notes app. Seal what matters with HavenRing.",
};

export default function LandingAlternateRoute() {
  return <LandingPage />;
}
