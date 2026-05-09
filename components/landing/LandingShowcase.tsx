"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { LandingFadeIn, landingEase } from "./LandingMotion";

function TabIconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.25">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function TabIconVault() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.25">
      <path d="M6 9h12v10a2 2 0 01-2 2H8a2 2 0 01-2-2V9zM9 9V7a3 3 0 016 0v2" />
    </svg>
  );
}

function TabIconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" stroke="currentColor" strokeWidth="1.25">
      <path d="M17 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M13 7a4 4 0 11-8 0 4 4 0 018 0zM21 21v-2a4 4 0 00-3-3.87M17 7h.01" />
    </svg>
  );
}

function RingTouchOrb() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative flex h-[112px] w-[112px] shrink-0 items-center justify-center">
      {!reduceMotion ? (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute rounded-full border border-amber-300/35"
              style={{ inset: "12%" }}
              animate={{
                scale: [1, 2.35],
                opacity: [0.42, 0],
              }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                delay: i * 0.75,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgba(232,190,130,0.18)_0%,transparent_68%)]"
            animate={{ opacity: [0.55, 0.95, 0.55] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgba(232,190,130,0.14)_0%,transparent_68%)]"
        />
      )}
      <div className="relative z-[1] flex h-[52px] w-[52px] items-center justify-center rounded-full border border-amber-200/25 bg-gradient-to-b from-white/[0.09] to-black/40 shadow-[0_0_36px_-8px_rgba(212,165,116,0.45)]">
        <span
          aria-hidden
          className="block h-7 w-7 rounded-full border-[1.5px] border-t-transparent border-amber-100/55"
        />
      </div>
    </div>
  );
}

export function LandingShowcase() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="landing-section-cv relative scroll-mt-28 border-t border-white/[0.06] bg-black px-5 py-[clamp(4rem,11vw,7rem)] sm:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_70%_30%,rgba(120,90,55,0.06),transparent_55%)]" aria-hidden />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-14 lg:flex-row lg:items-start lg:justify-between lg:gap-20">
        <LandingFadeIn className="flex max-w-xl flex-1 flex-col gap-6 lg:pt-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.48em] text-amber-200/58">
            A Ring. A Sanctuary.
          </p>
          <h2 className="text-balance text-[clamp(1.75rem,4vw,2.65rem)] font-medium leading-[1.14] tracking-[0.02em] text-white">
            Capture meaningful moments, then seal them with intention.
          </h2>
          <p className="text-pretty text-[15px] leading-[1.82] text-white/48">
            This is not another social product. It is a private sanctuary for moments that deserve
            dignity, not distribution.
          </p>
          <p className="text-pretty text-[15px] leading-[1.82] text-white/38">
            For full visual continuity, we split the new poster into curated scenes below while
            keeping the original poster fully visible above.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08] bg-black">
              <Image
                src="/landing/brand-poster-v2.png"
                alt="HavenRing logo crop"
                fill
                sizes="(max-width:1024px) 46vw, 220px"
                className="object-cover object-[12%_18%]"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08] bg-black">
              <Image
                src="/landing/brand-poster-v2.png"
                alt="HavenRing ring crop"
                fill
                sizes="(max-width:1024px) 46vw, 220px"
                className="object-cover object-[22%_72%]"
              />
            </div>
          </div>
        </LandingFadeIn>

        <motion.div
          className="relative flex w-full flex-1 justify-center lg:justify-end"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 1, ease: landingEase }}
        >
          <div className="landing-phone-frame relative aspect-[9/18.5] w-[min(100%,300px)] overflow-hidden rounded-[2.35rem] border border-white/[0.09] bg-[#070708] shadow-[0_56px_110px_-48px_rgba(0,0,0,0.88)] ring-1 ring-white/[0.03]">
            <div
              aria-hidden
              className="absolute left-1/2 top-3 z-20 h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black/90"
            />
            <div className="flex h-full flex-col px-4 pb-3 pt-[52px]">
              <p className="text-center text-[10px] uppercase tracking-[0.28em] text-white/38">
                Write your moment
              </p>
              <div className="landing-pull-quote mt-3 flex min-h-[120px] flex-1 rounded-[1rem] border border-white/[0.06] bg-white/[0.025] p-4">
                <p className="text-[13px] italic leading-[1.72] text-white/62 sm:text-[14px]">
                  &ldquo;The way you looked at me when we thought no one was watching.&rdquo;
                </p>
              </div>

              <div className="mt-6 flex flex-col items-center gap-2 pb-1">
                <RingTouchOrb />
                {reduceMotion ? (
                  <p className="text-center text-[10px] uppercase tracking-[0.26em] text-amber-200/55">
                    Touch your ring to seal it
                  </p>
                ) : (
                  <motion.p
                    className="text-center text-[10px] uppercase tracking-[0.26em] text-amber-200/55"
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    Touch your ring to seal it
                  </motion.p>
                )}
              </div>

              <div className="mt-auto grid grid-cols-3 gap-1 rounded-[1.15rem] border border-white/[0.05] bg-black/55 px-2 py-2.5 text-white/32">
                <div className="flex flex-col items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-amber-200/70">
                  <TabIconHome />
                  <span>Home</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <TabIconVault />
                  <span className="text-[9px] uppercase tracking-[0.14em]">Vault</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <TabIconPeople />
                  <span className="text-[9px] uppercase tracking-[0.14em]">People</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
