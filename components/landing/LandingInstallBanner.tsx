"use client";

import Link from "next/link";
import { usePlatform, isStandaloneDisplayMode } from "@/src/hooks/usePlatform";
import { getInstallGuideCopy } from "@/src/content/installGuideContent";

/** Mobile-only install CTA on the marketing site — platform copy never mixed. */
export function LandingInstallBanner() {
  const { platform, ready } = usePlatform();

  if (!ready || platform === "other" || isStandaloneDisplayMode()) {
    return null;
  }

  const copy = getInstallGuideCopy(platform);

  return (
    <section className="border-y border-white/10 bg-black/80">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#D4AF37]">
            {platform === "ios" ? "iPhone" : "Android"}
          </p>
          <p className="mt-2 max-w-xl text-sm text-[#F5F5F5]/85">{copy.lead}</p>
        </div>
        <Link
          href={`/setup?return=${encodeURIComponent("/")}`}
          className="shrink-0 rounded-full bg-[#D4AF37] px-8 py-3 text-sm font-medium text-black transition hover:bg-amber-300"
        >
          {platform === "ios" ? "Add to Home Screen" : "Install app"}
        </Link>
      </div>
    </section>
  );
}
