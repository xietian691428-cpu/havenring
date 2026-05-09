import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AMAZON_RITUAL_RING_URL } from "./constants";

function Badge({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-2.5">
      <span className="text-amber-200/85 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="max-w-[9rem] text-[10px] leading-snug tracking-[0.12em] text-white/55 sm:max-w-none">
        {label}
      </span>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-end overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(180,140,80,0.12),transparent_55%),radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(80,60,40,0.25),transparent_50%)]"
      />
      <div className="relative z-[1] flex w-full max-w-4xl flex-col items-center px-6 text-center">
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.03]"
            aria-hidden
          >
            <span className="block h-6 w-6 rounded-full border-2 border-t-transparent border-white/40" />
          </div>
          <p className="text-[10px] font-medium tracking-[0.55em] text-white/80">
            HAVENRING
          </p>
        </div>

        <h1 className="max-w-xl text-balance font-semibold leading-[1.05] tracking-tight text-white text-4xl sm:text-5xl md:text-6xl">
          Keep what matters.
        </h1>
        <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-white/60 sm:text-lg">
          A ring. Your moments. Only for you.
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Link
            href={AMAZON_RITUAL_RING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-100/95 to-amber-200/85 px-8 text-xs font-semibold uppercase tracking-[0.22em] text-black shadow-[0_0_40px_-8px_rgba(245,200,120,0.45)] transition hover:brightness-105"
          >
            Buy Ritual Ring
          </Link>
          <Link
            href="#waitlist"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] px-8 text-xs font-medium uppercase tracking-[0.2em] text-white/85 transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            Join Waitlist
          </Link>
        </div>

        <div className="relative mt-14 w-full max-w-3xl">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]">
            <Image
              src="/landing/hero-mood.png"
              alt="HavenRing — matte ring on a dark surface"
              fill
              priority
              sizes="(max-width:768px) 100vw, 560px"
              className="object-cover object-center"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />
          </div>
        </div>

        <div className="mt-14 grid w-full max-w-2xl grid-cols-1 gap-8 border-t border-white/[0.06] pt-10 sm:grid-cols-3 sm:gap-4">
          <Badge
            label="Private by design"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 11c-1.657 0-3-1.567-3-3.5V6a3 3 0 116 0v1.5c0 1.933-1.343 3.5-3 3.5z" />
                <path d="M6 10v8a2 2 0 002 2h8a2 2 0 002-2v-8" />
              </svg>
            }
          />
          <Badge
            label="Encrypted"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 3l7 4v5c0 5-3.5 8.5-7 9.5-3.5-1-7-4.5-7-9.5V7l7-4z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            }
          />
          <Badge
            label="Only with your people"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
                <path d="M3 21v-1a6 6 0 0112 0v1M21 21v-1a4 4 0 00-4-4h-2" />
              </svg>
            }
          />
        </div>
      </div>
    </section>
  );
}
