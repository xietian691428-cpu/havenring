"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const MOMENTS = [
  {
    image: "/images/moment-family.jpg",
    alt: "Family memory",
    title: "The first time she said “Dad”",
    caption: "A memory only you should keep forever.",
  },
  {
    image: "/images/moment-wedding.jpg",
    alt: "Wedding memory",
    title: "Vows whispered at sunset",
    caption: "Sealed in private. Remembered forever.",
  },
  {
    image: "/images/moment-solo.jpg",
    alt: "Solo travel memory",
    title: "That quiet moment on the mountain",
    caption: "Just you, the view, and the truth of the experience.",
  },
] as const;

export function LandingRealMoments() {
  return (
    <section
      id="real-moments"
      className="landing-section-cv scroll-mt-24 border-t border-white/5 bg-[#0A0A0A] py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.75, ease: landingEase }}
        >
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
            Real Moments
          </p>
          <h2 className="mb-4 text-4xl font-light tracking-tighter text-[#F5F5F5] md:text-5xl">
            Real moments.
            <br />
            Sealed with meaning.
          </h2>
          <p className="mx-auto max-w-md text-lg text-[#F5F5F5]/70">
            HavenRing is for the memories worth protecting
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {MOMENTS.map((moment, i) => (
            <motion.article
              key={moment.title}
              className="group"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-6%" }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: landingEase }}
            >
              <div className="relative mb-6 aspect-[4/3] overflow-hidden rounded-3xl bg-zinc-900">
                <Image
                  src={moment.image}
                  alt={moment.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
              </div>
              <h3 className="mb-2 text-xl text-[#F5F5F5]">{moment.title}</h3>
              <p className="text-[#AAAAAA]">{moment.caption}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
