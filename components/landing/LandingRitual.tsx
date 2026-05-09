"use client";

import { motion } from "framer-motion";
import { LandingFadeIn, landingEase } from "./LandingMotion";

export function LandingRitual() {
  return (
    <section className="landing-section-cv relative scroll-mt-28 overflow-hidden border-t border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_65%_at_50%_100%,rgba(140,100,55,0.18),transparent_55%)]"
      />
      <div className="relative mx-auto grid max-w-6xl gap-14 px-5 py-[clamp(4.5rem,12vw,8rem)] sm:gap-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
        <LandingFadeIn className="order-1 flex flex-col justify-center lg:order-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.48em] text-amber-200/55">
            The ritual
          </p>
          <blockquote className="mt-6 border-none p-0 text-[clamp(1.85rem,4.2vw,3rem)] font-medium leading-[1.18] tracking-[0.02em] text-white">
            Not everything needs to be shared.
            <span className="landing-pull-quote mt-4 block text-[0.72em] font-normal italic text-white/72">
              Some things just need to stay.
            </span>
          </blockquote>
          <p className="mt-10 max-w-lg text-pretty text-[15px] leading-[1.82] text-white/52">
            We built HavenRing for the in-between hours — when love is not content and grief is
            not a thread. Your ring is a vow of containment: a tactile reminder that intimacy
            does not require an audience.
          </p>
          <p className="mt-6 max-w-lg text-pretty text-[15px] leading-[1.82] text-white/42">
            In a culture that trades attention for oxygen, choosing discretion is its own kind
            of courage. Seal what must not be diluted. Carry it like jewelry, not like data.
          </p>
        </LandingFadeIn>

        <motion.div
          className="order-2 lg:order-1"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-12% 0px" }}
          transition={{ duration: 1.05, ease: landingEase }}
        >
          <div className="relative mx-auto flex max-w-md flex-col gap-6 overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-zinc-950 p-7 shadow-[0_70px_140px_-56px_rgba(0,0,0,0.92)] lg:mx-0 lg:max-w-none lg:p-9">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_28%_20%,rgba(214,168,104,0.15),transparent_65%)]"
            />
            <div className="relative z-[1] flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/35 text-amber-200/85">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="h-5 w-5">
                  <path d="M12 21s-6-4.35-6-10a6 6 0 1112 0c0 5.65-6 10-6 10z" />
                </svg>
              </span>
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/68">A private sanctuary</p>
            </div>
            <p className="landing-serif-headline relative z-[1] text-[1.2rem] italic leading-relaxed text-white/70 sm:text-[1.35rem]">
              Sacred does not mean loud. Sometimes it means untouched.
            </p>
            <ul className="relative z-[1] space-y-3 border-t border-white/[0.08] pt-5 text-[13px] leading-relaxed text-white/52">
              <li>Physical key for your personal digital haven.</li>
              <li>Private by design with encrypted moments.</li>
              <li>Share by choice, never by default.</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
