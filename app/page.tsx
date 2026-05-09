import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/components/landing/constants";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "HavenRing — Keep what matters.",
    template: "%s — HavenRing",
  },
  description:
    "A ring. Your moments. Only for you. Capture, seal, and treasure private memories — no feeds, no followers.",
  openGraph: {
    title: "HavenRing — Keep what matters.",
    description:
      "Capture meaningful moments and seal them with a touch. Private by design.",
    url: SITE_ORIGIN,
    siteName: "HavenRing",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HavenRing — Keep what matters.",
    description:
      "A ring. Your moments. Only for you. Capture, seal, and treasure private memories.",
  },
};

export default function Home() {
  return <LandingPage />;
}
