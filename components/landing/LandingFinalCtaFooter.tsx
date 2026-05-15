import Link from "next/link";
import { AMAZON_RITUAL_RING_URL } from "./constants";

export function LandingFinalCtaFooter() {
  const year = new Date().getFullYear();

  return (
    <section className="border-t border-white/10 bg-black py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="mb-8 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-6xl">
          Start sealing
          <br />
          what matters most.
        </h2>

        <div className="mb-16 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex min-h-[56px] items-center justify-center rounded-full bg-[#D4AF37] px-12 py-5 text-xl font-medium text-black transition hover:scale-[1.02] hover:bg-amber-300"
          >
            Buy Your Ritual Ring — $49
          </Link>
          <a
            href={AMAZON_RITUAL_RING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/50 px-12 py-5 text-xl font-medium text-[#F5F5F5] transition hover:scale-[1.02] hover:border-white"
          >
            Shop on Amazon
          </a>
        </div>

        <p className="text-sm leading-relaxed text-[#AAAAAA]">
          Free shipping • 30-day money-back guarantee
          <br />
          Made for those who believe some things are too precious to share with the world.
        </p>
      </div>

      <footer className="mt-24 border-t border-white/10 pt-12">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-white/40">
          <p>© {year} HavenRing. All rights reserved.</p>
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs">
            <Link href="/privacy-policy" className="transition hover:text-white/70">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-white/70">
              Terms
            </Link>
            <a href="mailto:hello@havenring.me" className="transition hover:text-white/70">
              hello@havenring.me
            </a>
            <Link href="/login" className="transition hover:text-white/70">
              Sign in
            </Link>
            <Link href="/app" className="transition hover:text-white/70">
              Open App
            </Link>
          </nav>
        </div>
      </footer>
    </section>
  );
}
