"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const PILLARS = [
  {
    icon: "🔒",
    title: "Local First",
    body: "Your memories stay on your device by default.",
  },
  {
    icon: "🔑",
    title: "Physical Key",
    body: "Only you hold the ring that unlocks the ritual.",
  },
  {
    icon: "🛡️",
    title: "End-to-End Encrypted",
    body: "When cloud sync is enabled, we still cannot access your content.",
  },
] as const;

export function LandingTrustPrivacy() {
  return (
    <section
      id="trust-privacy"
      className="landing-section-cv scroll-mt-24 border-t border-white/5 bg-[#0A0A0A] py-24 md:py-32"
    >
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.75, ease: landingEase }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
            Trust & Privacy
          </p>
          <h2 className="mb-16 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-5xl">
            Built for those who value privacy
          </h2>
        </motion.div>

        <div className="grid gap-10 md:grid-cols-3">
          {PILLARS.map((pillar, i) => (
            <motion.div
              key={pillar.title}
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-6%" }}
              transition={{ duration: 0.75, delay: i * 0.08, ease: landingEase }}
            >
              <div className="text-5xl" aria-hidden>
                {pillar.icon}
              </div>
              <h3 className="text-xl text-[#F5F5F5]">{pillar.title}</h3>
              <p className="text-[#F5F5F5]/70">{pillar.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-20 text-sm text-[#AAAAAA]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <p>We cannot read your memories. Ever.</p>
          <Link
            href="/privacy-policy"
            className="mt-4 inline-block underline underline-offset-4 transition hover:text-[#F5F5F5]/90"
          >
            Read our Privacy Policy
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
