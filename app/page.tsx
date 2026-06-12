import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "HavenRing — Your Private Memory Sanctuary",
    template: "%s — HavenRing",
  },
  description:
    "Your private memory sanctuary. Local-first, encrypted on your device. Optional ring to seal.",
  openGraph: {
    title: "HavenRing — Your Private Memory Sanctuary",
    description:
      "Write precious moments. Touch your ring to seal. Plus: optional cloud backup and explicit sharing.",
    url: SITE_ORIGIN,
    siteName: "HavenRing",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HavenRing — Your Private Memory Sanctuary",
    description:
      "Your private memory sanctuary. Local-first. Optional ring to seal. Plus cloud backup where offered.",
  },
};

export default function Home() {
  return <LandingPage />;
}
