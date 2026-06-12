import Image from "next/image";
import Link from "next/link";
import { AMAZON_RITUAL_RING_URL } from "./constants";

export function LandingHero() {
  return (
    <section className="relative min-h-[100svh] bg-black px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(6.2rem+env(safe-area-inset-top))] sm:px-8 sm:pt-[calc(7rem+env(safe-area-inset-top))]">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
        <div className="relative overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#080808] shadow-[0_44px_90px_-42px_rgba(0,0,0,0.9)]">
          <div className="relative aspect-[1024/682] w-full">
            <Image
              src="/landing/brand-poster-v2.png"
              alt="HavenRing poster"
              fill
              priority
              sizes="(max-width:1024px) 100vw, 62vw"
              className="object-contain"
            />
          </div>
        </div>

        <div className="flex flex-col rounded-[1.25rem] border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.38em] text-amber-200/58">Haven</p>
          <h1 className="mt-4 text-balance text-[clamp(2rem,5.2vw,3rem)] font-medium leading-[1.1] text-white">
            Your Private Memory Sanctuary
          </h1>
          <p className="landing-pull-quote mt-2 text-[clamp(1.15rem,2.6vw,1.45rem)] leading-snug text-amber-100/82">
            Write what matters. Touch your ring to seal. Encrypted on your device.
          </p>

          <ul className="mt-7 space-y-4 border-t border-white/[0.08] pt-6 text-[13px] leading-relaxed text-white/60">
            <li><span className="text-amber-200/85">Your space:</span> Personal memories, local-first.</li>
            <li><span className="text-amber-200/85">Seal ritual:</span> Write, then touch your ring once.</li>
            <li><span className="text-amber-200/85">No ring required:</span> Sign in to read and write anytime.</li>
            <li><span className="text-amber-200/85">Plus:</span> Optional cloud backup and explicit sharing.</li>
          </ul>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <Link
              href={AMAZON_RITUAL_RING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-gradient-to-b from-[#f6ead4] via-[#ebcf98] to-[#c99562] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#1a1209]"
            >
              Buy Ritual Ring
            </Link>
            <Link
              href="#waitlist"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/18 bg-black/25 px-6 text-[11px] font-medium uppercase tracking-[0.2em] text-white/86"
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
