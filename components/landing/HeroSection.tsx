"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AMAZON_RITUAL_RING_URL } from "./constants";
import { HERO_AUTO_ADVANCE_MS, HERO_CAROUSEL_SLIDES } from "./hero-slides";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const n = HERO_CAROUSEL_SLIDES.length;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (i: number) => {
      setIndex(((i % n) + n) % n);
    },
    [n]
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    if (reduceMotion || n <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % n);
    }, HERO_AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [n, reduceMotion]);

  const slide = HERO_CAROUSEL_SLIDES[index]!;

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0A] pt-[calc(5.5rem+env(safe-area-inset-top))] pb-16 md:pt-[calc(6.25rem+env(safe-area-inset-top))]">
      {/* Background carousel */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.src}
            className="absolute inset-0"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/35" aria-hidden />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dark gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/70 to-black"
        aria-hidden
      />

      {/* Optional caption on image */}
      {slide.caption ? (
        <p
          className="pointer-events-none absolute bottom-28 left-0 right-0 z-[15] mx-auto hidden max-w-3xl px-8 text-center text-sm font-light tracking-wide text-white/50 md:block"
          aria-hidden
        >
          {slide.caption}
        </p>
      ) : null}

      {/* Carousel controls */}
      {n > 1 ? (
        <>
          <div className="absolute bottom-24 left-0 right-0 z-[25] flex justify-center gap-2 md:bottom-28">
            {HERO_CAROUSEL_SLIDES.map((s, i) => (
              <button
                key={s.src}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-8 bg-[#D4AF37]" : "w-1.5 bg-white/35 hover:bg-white/55"
                }`}
              />
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 z-[25] hidden w-14 items-center justify-center md:flex">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={prev}
              className="rounded-full border border-white/20 bg-black/30 px-2 py-3 text-white/70 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              ‹
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 z-[25] hidden w-14 items-center justify-center md:flex">
            <button
              type="button"
              aria-label="Next slide"
              onClick={next}
              className="rounded-full border border-white/20 bg-black/30 px-2 py-3 text-white/70 backdrop-blur-sm transition hover:border-white/40 hover:text-white"
            >
              ›
            </button>
          </div>
        </>
      ) : null}

      {/* Content */}
      <motion.div
        className="relative z-20 mx-auto max-w-5xl px-6 text-center"
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-md">
          <span className="text-sm tracking-[0.35em] text-[#D4AF37]">HAVENRING</span>
        </div>

        <h1 className="mb-6 text-4xl font-light leading-[1.05] tracking-tighter text-white sm:text-5xl md:text-7xl">
          Your most important memories,
          <br />
          <span className="bg-gradient-to-r from-[#D4AF37] to-amber-300 bg-clip-text font-medium text-transparent">
            sealed forever.
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/90 md:text-2xl">
          A beautiful physical ring that serves as your private key.
          <br />
          Capture meaningful moments and seal them with intention —{" "}
          <span className="text-white">only for you and those you choose.</span>
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-3 rounded-full bg-[#D4AF37] px-8 py-4 text-lg font-medium text-black transition-colors hover:bg-amber-300 sm:px-10 min-h-[52px]"
            >
              Buy Ritual Ring — $49
              <span className="text-xl transition group-hover:rotate-12" aria-hidden>
                →
              </span>
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.99 }}>
            <a
              href={AMAZON_RITUAL_RING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/40 px-8 py-4 text-lg font-medium text-white transition hover:border-white/70"
            >
              Shop on Amazon
            </a>
          </motion.div>
        </div>

        <p className="mt-8 text-sm text-white/60">
          Free shipping worldwide • 30-day ritual guarantee • No subscription to start
        </p>
      </motion.div>

      {/* Scroll hint */}
      <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center text-xs tracking-[0.35em] text-white/50">
        <span>SCROLL TO EXPLORE</span>
        <div
          className="mt-2 h-12 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent"
          aria-hidden
        />
      </div>
    </section>
  );
}
