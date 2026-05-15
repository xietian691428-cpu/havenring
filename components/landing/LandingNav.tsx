import Image from "next/image";
import Link from "next/link";

const NAV_ANCHORS = [
  { href: "#story", label: "Story" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#real-moments", label: "Moments" },
  { href: "#the-ring", label: "The ring" },
  { href: "#trust-privacy", label: "Privacy" },
] as const;

export function LandingNav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
      <div className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-full border border-white/[0.1] bg-[#0A0A0A]/75 px-3 py-2 backdrop-blur-md sm:gap-4 sm:px-4 sm:py-2.5">
        <Link
          href="/"
          className="relative block h-7 w-[140px] shrink-0 overflow-hidden rounded-md border border-white/[0.08] sm:w-[170px]"
          aria-label="HavenRing home"
        >
          <Image
            src="/landing/brand-poster-v2.png"
            alt="HavenRing"
            fill
            sizes="170px"
            className="object-cover object-[14%_10%]"
          />
        </Link>
        <nav className="hidden items-center gap-1 text-[10px] font-medium tracking-[0.18em] text-[#AAAAAA] lg:flex xl:gap-2">
          {NAV_ANCHORS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-2 py-1.5 transition hover:bg-white/[0.06] hover:text-[#F5F5F5]"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/help"
            className="hidden text-[10px] tracking-[0.2em] text-[#666666] transition hover:text-[#AAAAAA] sm:inline"
          >
            Help
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-medium tracking-[0.16em] text-[#F5F5F5]/90 transition hover:border-white/25 sm:px-3"
          >
            Sign in
          </Link>
          <Link
            href="/app"
            className="rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/[0.12] px-2.5 py-1.5 text-[10px] font-medium tracking-[0.18em] text-[#D4AF37] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/20 sm:px-3"
          >
            Open App
          </Link>
        </div>
      </div>
    </header>
  );
}
