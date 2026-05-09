import Link from "next/link";

export function LandingNav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
      <div className="pointer-events-auto flex w-full max-w-6xl items-center justify-between gap-4 rounded-full border border-white/[0.08] bg-black/55 px-4 py-2.5 backdrop-blur-md">
        <Link
          href="/"
          className="text-[10px] font-medium tracking-[0.42em] text-white/95 hover:text-white"
          aria-label="HavenRing home"
        >
          HAVENRING
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/help"
            className="hidden text-[10px] tracking-[0.2em] text-white/55 transition-colors hover:text-white/90 sm:inline"
          >
            Help
          </Link>
          <Link
            href="/app"
            className="rounded-full border border-amber-400/35 bg-amber-400/[0.06] px-3 py-1.5 text-[10px] font-medium tracking-[0.18em] text-amber-100/95 transition-colors hover:border-amber-300/50 hover:bg-amber-400/10"
          >
            Open App
          </Link>
        </nav>
      </div>
    </header>
  );
}
