import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  const origin = SITE_ORIGIN.replace(/\/$/, "");
  return {
    name: "Haven Ring",
    short_name: "Haven",
    description:
      "Seal a private moment with a touch of the ring. Sealed forever.",
    id: `${origin}/app`,
    start_url: `${origin}/app`,
    scope: `${origin}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["lifestyle", "personalization"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
