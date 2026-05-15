"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { landingEase } from "./LandingMotion";

const POSTER_SRC = "/landing/poster-promises-sealed.png";

export function LandingPromisesPoster() {
  return (
    <section
      aria-label="HavenRing — Some promises deserve to be sealed forever"
      className="border-y border-white/5 bg-[#0A0A0A]"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-5%" }}
        transition={{ duration: 0.9, ease: landingEase }}
      >
        <Link
          href="/shop"
          className="group relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
        >
          <Image
            src={POSTER_SRC}
            alt="HavenRing — Some promises deserve to be sealed forever. Wedding moment with ritual ring."
            width={1024}
            height={576}
            sizes="100vw"
            className="h-auto w-full transition duration-700 group-hover:brightness-105"
            priority={false}
          />
          <span className="sr-only">Shop the Ritual Ring</span>
        </Link>
      </motion.div>
    </section>
  );
}
