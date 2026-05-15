"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const STEPS = [
  {
    num: "1",
    title: "Capture the Moment",
    body: "Write your thoughts, add photos or videos of the people and experiences that matter most.",
    accent: false,
  },
  {
    num: "2",
    title: "Seal with Intention",
    body: "Touch your HavenRing to your phone to perform the ritual. This moment is now sealed — sacred and protected.",
    accent: true,
  },
  {
    num: "3",
    title: "Yours Forever",
    body: "Local-first. End-to-end encrypted. Only you control access. No one else can see it.",
    accent: false,
  },
] as const;

export function LandingHowItWorksLux() {
  return (
    <section
      id="how-it-works"
      className="landing-section-cv scroll-mt-24 border-t border-white/5 bg-black py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.75, ease: landingEase }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
            How It Works
          </p>
          <h2 className="mb-4 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-5xl">
            Three steps.
            <br />
            One sacred ritual.
          </h2>
          <p className="text-lg text-[#F5F5F5]/70">Simple. Private. Beautifully intentional.</p>
        </motion.div>

        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {STEPS.map((step, i) => (
            <motion.article
              key={step.title}
              className="group"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ duration: 0.75, delay: i * 0.1, ease: landingEase }}
            >
              <div
                className={`mb-8 flex h-14 w-14 items-center justify-center rounded-2xl text-3xl font-light transition duration-300 group-hover:scale-110 ${
                  step.accent
                    ? "bg-[#D4AF37] text-black"
                    : "bg-white/10 text-[#F5F5F5]"
                }`}
              >
                {step.num}
              </div>
              <h3 className="mb-4 text-2xl font-medium tracking-tight text-[#F5F5F5]">
                {step.title}
              </h3>
              <p className="leading-relaxed text-[#F5F5F5]/70">{step.body}</p>
            </motion.article>
          ))}
        </div>

        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: landingEase }}
        >
          <Link
            href="/shop"
            className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#D4AF37] px-10 py-4 text-lg font-medium text-black transition hover:scale-[1.02] hover:bg-amber-300"
          >
            Begin Your Ritual — $49
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
