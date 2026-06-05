import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "HavenRing — Keep what matters.",
    template: "%s — HavenRing",
  },
  description:
    "A private memory ring for personal records and couples. Capture, seal, and treasure memories — no feeds, no followers.",
  openGraph: {
    title: "HavenRing — Keep what matters.",
    description:
      "Capture personal records and couple memories, then seal them with a touch. Private by design.",
    url: SITE_ORIGIN,
    siteName: "HavenRing",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HavenRing — Keep what matters.",
    description:
      "A ring for personal records and private couple memories. Capture, seal, and treasure what matters.",
  },
};

export default function Home() {
  return <LandingPage />;
}
