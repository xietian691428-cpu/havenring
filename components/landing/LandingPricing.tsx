"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AMAZON_RITUAL_RING_URL } from "./constants";
import { LandingFadeIn, landingEase } from "./LandingMotion";

export function LandingPricing() {
  return (
    <section className="scroll-mt-28 border-t border-white/[0.06] bg-[#050506] px-5 py-[clamp(4rem,11vw,7rem)] sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:gap-14">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.9, ease: landingEase }}
          className="flex flex-col rounded-[1.35rem] border border-amber-400/22 bg-gradient-to-b from-amber-400/[0.09] via-amber-950/[0.03] to-transparent p-8 sm:p-10"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-amber-200/72">
            The ring
          </p>
          <h2 className="mt-4 text-[clamp(1.65rem,3vw,2.25rem)] font-medium tracking-[0.02em] text-white">
            Ritual Ring
          </h2>
          <p className="landing-pull-quote mt-3 text-[clamp(2rem,4vw,2.75rem)] font-normal italic tracking-tight text-white/88">
            $39–$49
          </p>
          <p className="mt-5 text-[15px] leading-[1.82] text-white/52">
            Matte ceramic body, NFC heart, proportions meant for every day — not a gadget that shouts,
            but jewelry that remembers its role.
          </p>
          <p className="mt-4 text-[14px] leading-[1.75] text-white/38">
            The ring is the verb in your sentence: write, then touch, and what matters stops being
            hypothetical.
          </p>
          <Link
            href={AMAZON_RITUAL_RING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 inline-flex min-h-[52px] max-w-xs items-center justify-center rounded-full bg-gradient-to-b from-[#f6ead4] via-[#ebcf98] to-[#c99562] px-8 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#1a1209] shadow-[0_0_0_1px_rgba(255,252,245,0.28)_inset,0_18px_48px_-12px_rgba(200,145,85,0.48)] transition hover:brightness-[1.03]"
          >
            Buy on Amazon
          </Link>
        </motion.div>

        <LandingFadeIn className="flex flex-col justify-center rounded-[1.35rem] border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
          <p className="text-[10px] font-medium uppercase tracking-[0.42em] text-white/40">
            Haven Plus
          </p>
          <h2 className="mt-4 text-[clamp(1.65rem,3vw,2.25rem)] font-medium tracking-[0.02em] text-white">
            When your circle grows — carefully
          </h2>
          <ul className="mt-8 flex flex-col gap-5 text-[14px] leading-[1.75] text-white/52">
            <li className="flex gap-3 border-l border-amber-400/25 pl-4">
              Room for shared memories — only with people you invite by name, not by suggestion chip.
            </li>
            <li className="flex gap-3 border-l border-amber-400/25 pl-4">
              First access to hardware iterations and the quiet improvements we ship between launches.
            </li>
            <li className="flex gap-3 border-l border-amber-400/25 pl-4">
              Optional cloud backup with your keys still feeling like yours — not a billboard lease.
            </li>
          </ul>
          <p className="mt-10 text-[12px] tracking-[0.06em] text-white/32">
            Plans and limits live inside the app once you sign in — transparency without clutter on this page.
          </p>
        </LandingFadeIn>
      </div>
    </section>
  );
}
