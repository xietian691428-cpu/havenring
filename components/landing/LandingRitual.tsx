"use client";

import Image from "next/image";
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
          <div className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-zinc-950 shadow-[0_70px_140px_-56px_rgba(0,0,0,0.92)] lg:mx-0 lg:max-w-none">
            <Image
              src="/landing/hero-mood.png"
              alt="HavenRing — ceremony and stillness"
              fill
              sizes="(max-width:1024px) 100vw, 45vw"
              className="object-cover object-[center_35%]"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/55 via-transparent to-amber-950/20" />
            <p className="landing-serif-headline absolute bottom-6 left-6 right-6 text-[14px] italic leading-relaxed text-white/58 sm:bottom-8 sm:left-8 sm:right-8 sm:text-[15px]">
              Sacred does not mean loud. Sometimes it means untouched.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
