import Link from "next/link";
import { AMAZON_RITUAL_RING_URL } from "./constants";

export function LandingPricing() {
  return (
    <section className="border-t border-white/[0.06] bg-[#050506] px-6 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-amber-400/20 bg-gradient-to-b from-amber-400/[0.07] to-transparent p-8 sm:p-10">
          <p className="text-[10px] font-medium tracking-[0.4em] text-amber-200/80">
            THE RING
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            Ritual Ring
          </h2>
          <p className="mt-2 text-3xl font-light tracking-tight text-white sm:text-4xl">
            $39–$49
          </p>
          <p className="mt-4 leading-relaxed text-white/55">
            Matte ceramic finish, NFC core, sized for daily wear. The physical key to your
            quietest memories.
          </p>
          <Link
            href={AMAZON_RITUAL_RING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex min-h-11 max-w-xs items-center justify-center rounded-full bg-white px-6 text-xs font-semibold uppercase tracking-[0.2em] text-black transition hover:bg-white/90"
          >
            Buy on Amazon
          </Link>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
          <p className="text-[10px] font-medium tracking-[0.4em] text-white/45">
            HAVEN PLUS
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            For households who want more room
          </h2>
          <ul className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-white/55">
            <li className="flex gap-2">
              <span className="text-amber-200/80">—</span>
              Shared moments with people you explicitly invite
            </li>
            <li className="flex gap-2">
              <span className="text-amber-200/80">—</span>
              Priority updates and early hardware drops
            </li>
            <li className="flex gap-2">
              <span className="text-amber-200/80">—</span>
              Optional cloud backup where you stay in control
            </li>
          </ul>
          <p className="mt-8 text-xs tracking-[0.14em] text-white/35">
            Details inside the app after you sign in.
          </p>
        </div>
      </div>
    </section>
  );
}
