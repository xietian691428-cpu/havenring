"use client";

import { motion } from "framer-motion";
import { LandingFadeIn, landingEase } from "./LandingMotion";

const STEPS = [
  {
    num: "01",
    title: "Write",
    body: "Put language around what you felt — a glance, a vow, a grief you do not owe the internet.",
    hint: "Journal",
  },
  {
    num: "02",
    title: "Touch",
    body: "Bring your ring to your phone. The gesture is small; the intention is not.",
    hint: "NFC",
  },
  {
    num: "03",
    title: "Seal",
    body: "That moment becomes encrypted and yours alone — not performance, not content.",
    hint: "Lock",
  },
  {
    num: "04",
    title: "Treasure",
    body: "Return when you need warmth, proof, or silence. No algorithm decides what survives.",
    hint: "Vault",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section className="landing-section-cv scroll-mt-28 border-t border-white/[0.06] bg-[#050506] px-5 py-[clamp(4.5rem,12vw,8rem)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <LandingFadeIn>
          <p className="text-[10px] font-medium uppercase tracking-[0.48em] text-amber-200/55">
            How it works
          </p>
          <h2 className="mt-5 max-w-3xl text-balance text-[clamp(1.85rem,4.5vw,2.75rem)] font-medium leading-[1.15] tracking-[0.02em] text-white">
            From impulse to artifact — four quiet movements.
          </h2>
          <p className="mt-5 max-w-2xl text-pretty text-[15px] leading-relaxed text-white/48">
            Write, touch, seal, treasure. No stage. No followers. Only the gravity of what you
            choose to keep.
          </p>
        </LandingFadeIn>

        <ol className="relative mt-16 space-y-0 sm:mt-20">
          <span
            aria-hidden
            className="absolute left-[23px] top-4 bottom-4 hidden w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent sm:block lg:left-[27px]"
          />
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{
                duration: 0.75,
                delay: i * 0.08,
                ease: landingEase,
              }}
              className="relative grid gap-6 border-t border-white/[0.06] py-10 first:border-t-0 first:pt-0 sm:grid-cols-[auto_1fr] sm:gap-10 sm:py-12"
            >
              <div className="flex items-start gap-5 sm:block sm:pt-1">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-amber-400/22 bg-gradient-to-b from-white/[0.06] to-transparent shadow-[0_0_40px_-14px_rgba(212,165,116,0.35)] sm:h-[58px] sm:w-[58px]">
                  <span className="text-[11px] font-semibold tracking-[0.28em] text-amber-100/90">
                    {step.num}
                  </span>
                </div>
                <span className="pt-3 text-[9px] uppercase tracking-[0.32em] text-white/28 sm:hidden">
                  {step.hint}
                </span>
              </div>
              <div className="min-w-0 sm:pt-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-2xl font-medium tracking-[0.03em] text-white">
                    {step.title}
                  </h3>
                  <span className="hidden text-[9px] uppercase tracking-[0.32em] text-white/28 sm:inline">
                    {step.hint}
                  </span>
                </div>
                <p className="mt-4 max-w-xl text-[15px] leading-[1.72] text-white/52">
                  {step.body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
