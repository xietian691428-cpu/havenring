import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "HavenRing — Your Private Memory Sanctuary",
  description:
    "Write precious moments. Touch your ring to seal. Local-first, encrypted on your device.",
};

export default function LandingAlternateRoute() {
  return <LandingPage />;
}
