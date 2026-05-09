"use client";

import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const QUOTES = [
  {
    quote: "Finally something that treats love like it deserves quiet — not likes.",
    context: "Anniversary letters",
    name: "Alex",
    locale: "USA",
  },
  {
    quote: "We stopped performing our relationship online. This feels like ours again.",
    context: "Couples journal",
    name: "Sarah",
    locale: "UK",
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="scroll-mt-28 border-t border-white/[0.06] bg-black px-5 py-[clamp(3.5rem,10vw,6rem)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <motion.p
          className="text-center text-[10px] font-medium uppercase tracking-[0.48em] text-white/34"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75, ease: landingEase }}
        >
          Voices from people who wanted silence back
        </motion.p>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-10">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-6% 0px" }}
              transition={{ duration: 0.85, delay: i * 0.12, ease: landingEase }}
              className="flex flex-col gap-5 border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-transparent px-7 py-9 sm:px-9 sm:py-10"
            >
              <div className="flex gap-0.5 text-amber-200/65" aria-hidden>
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} className="text-[15px] leading-none">
                    ★
                  </span>
                ))}
              </div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-amber-200/45">{q.context}</p>
              <blockquote className="landing-pull-quote text-[1.125rem] font-normal italic leading-[1.65] text-white/82 sm:text-[1.2rem]">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="text-[11px] tracking-[0.22em] text-white/38">
                {q.name} · {q.locale}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
