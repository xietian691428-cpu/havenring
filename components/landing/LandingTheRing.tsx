"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const SPECS = [
  { label: "Material", value: "Grade 5 Titanium • Hypoallergenic" },
  { label: "Finish", value: "Matte Black • Silver • Rose Gold" },
  { label: "Engraving", value: "Subtle sacred geometry inside" },
  { label: "Price", value: "$39 – $49", emphasis: true },
] as const;

export function LandingTheRing() {
  return (
    <section
      id="the-ring"
      className="landing-section-cv scroll-mt-24 border-t border-white/5 bg-black py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid items-center gap-16 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.85, ease: landingEase }}
          >
            <div className="relative aspect-square overflow-hidden rounded-[3rem] bg-zinc-900">
              <Image
                src="/images/ring-hero.jpg"
                alt="HavenRing Ritual Ring"
                fill
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-cover object-center"
              />
            </div>
          </motion.div>

          <motion.div
            className="space-y-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.85, delay: 0.06, ease: landingEase }}
          >
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
                The Ring
              </p>
              <h2 className="mb-6 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-5xl">
                Not just jewelry.
                <br />
                A key to your sanctuary.
              </h2>
              <p className="text-lg text-[#F5F5F5]/80">
                Crafted from premium titanium, each HavenRing is lightweight, durable, and designed
                to be worn every day.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm">
              {SPECS.map((spec) => (
                <div key={spec.label}>
                  <div className="mb-1 text-[#D4AF37]">{spec.label}</div>
                  <div
                    className={
                      "emphasis" in spec && spec.emphasis
                        ? "font-medium text-[#F5F5F5]"
                        : "text-[#F5F5F5]"
                    }
                  >
                    {spec.value}
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/shop"
              className="inline-flex min-h-[52px] items-center gap-3 rounded-full bg-[#D4AF37] px-10 py-4 text-lg font-medium text-black transition hover:scale-[1.02] hover:bg-amber-300"
            >
              Choose Your Ring
              <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
