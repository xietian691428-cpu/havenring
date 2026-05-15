import Link from "next/link";
import { AMAZON_RITUAL_RING_URL, SITE_ORIGIN, WAITLIST_MAILTO } from "./constants";

export function LandingFooter() {
  return (
    <footer
      id="waitlist"
      className="landing-section-cv border-t border-white/[0.08] bg-[#020203] px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-md">
          <p className="flex items-start gap-3 text-sm leading-relaxed text-white/52">
            <span className="mt-0.5 shrink-0 text-amber-200/48" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="h-6 w-6">
                <path d="M12 21s-6-4.35-6-10a6 6 0 1112 0c0 5.65-6 10-6 10z" />
              </svg>
            </span>
            <span>
              Not everything needs to be shared.
              <span className="mt-1 block text-white/68">
                Some things simply need to stay — untouched, unpriced, unposted.
              </span>
            </span>
          </p>
        </div>
        <div className="max-w-lg text-center lg:text-right">
          <p className="text-sm leading-relaxed text-white/42">
            HavenRing is jewelry with memory — a tactile vow that what matters most need not become content.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-stretch gap-6 border-t border-white/[0.06] pt-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.35em] text-white/35">
            JOIN THE WAITLIST
          </span>
          <a
            href={WAITLIST_MAILTO}
            className="w-fit text-sm text-amber-200/85 underline-offset-4 hover:underline"
          >
            hello@havenring.me
          </a>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          <Link
            href={AMAZON_RITUAL_RING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] px-8 text-xs font-medium uppercase tracking-[0.22em] text-white/90 transition hover:border-amber-400/35 hover:bg-amber-400/[0.06]"
          >
            Buy Ritual Ring
          </Link>
          <span className="text-[10px] tracking-[0.15em] text-white/30">{SITE_ORIGIN}</span>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center justify-center gap-6 text-[11px] tracking-[0.18em] text-white/35 sm:justify-between">
        <Link href="/privacy-policy" className="hover:text-white/55">
          Privacy Policy
        </Link>
        <Link href="/login" className="hover:text-white/55">
          Sign in
        </Link>
        <Link href="/app" className="hover:text-white/55">
          Open App
        </Link>
        <Link href="/help" className="hover:text-white/55">
          Help
        </Link>
      </div>
    </footer>
  );
}
