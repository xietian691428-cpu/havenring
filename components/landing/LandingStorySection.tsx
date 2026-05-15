"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const STORY_IMAGE_SRC = "/images/story-family.jpg";

export function LandingStorySection() {
  return (
    <section
      id="story"
      className="landing-section-cv scroll-mt-24 border-t border-white/5 bg-[#0A0A0A] py-24 md:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.8, ease: landingEase }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
            The Story
          </p>
          <h2 className="mb-6 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-5xl">
            In a noisy world,
            <br />
            some moments deserve silence.
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-[#F5F5F5]/70 md:text-xl">
            HavenRing was created for those who want to protect what truly matters — away from
            algorithms, clouds, and endless scrolling.
          </p>
        </motion.div>

        <div className="grid items-center gap-10 md:grid-cols-12 md:gap-12">
          <motion.div
            className="md:col-span-7"
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ duration: 0.85, ease: landingEase }}
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-zinc-900">
              <Image
                src={STORY_IMAGE_SRC}
                alt="Family moment sealed with HavenRing"
                fill
                sizes="(max-width: 768px) 100vw, 58vw"
                className="object-cover object-center"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-black/10"
                aria-hidden
              />
            </div>
          </motion.div>

          <motion.div
            className="space-y-8 md:col-span-5"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-8%" }}
            transition={{ duration: 0.85, delay: 0.08, ease: landingEase }}
          >
            <div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-[#D4AF37]">
                The Problem
              </h3>
              <p className="text-xl leading-tight text-[#F5F5F5]/90 md:text-2xl">
                Our most precious memories are trapped in apps that mine our data, show them to
                strangers, and can disappear at any moment.
              </p>
            </div>

            <div>
              <h3 className="mb-3 text-sm uppercase tracking-[0.2em] text-[#D4AF37]">
                Our Solution
              </h3>
              <p className="text-xl leading-tight text-[#F5F5F5]/90 md:text-2xl">
                HavenRing gives you a private sanctuary. A physical key that lets you capture,
                seal, and protect your most meaningful moments — only for you and the people you
                love.
              </p>
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="text-base italic leading-relaxed text-[#AAAAAA] md:text-lg">
                &ldquo;Not everything needs to be shared.
                <br />
                Some things only need to be remembered.&rdquo;
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
