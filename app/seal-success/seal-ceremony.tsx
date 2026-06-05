"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { APP_ENTRY_PATH } from "@/lib/site";
import { getSealFlowCopy } from "@/src/content/havenCopy";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";

const PARTICLE_COUNT = 14;

function SealCelebrationParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: `${8 + ((i * 37) % 84)}%`,
        top: `${12 + ((i * 53) % 76)}%`,
        size: 3 + (i % 4),
        delay: (i % 7) * 0.35,
        duration: 3.2 + (i % 5) * 0.4,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-[#D4AF37]/40"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 0.85, 0.35, 0],
            scale: [0.4, 1.2, 0.8, 0.3],
            y: [0, -28, -52],
          }}
          transition={{
            duration: p.duration,
            delay: 0.6 + p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
      <motion.div
        className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D4AF37]/10 blur-3xl"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0.25, 0.45, 0.25], scale: [0.9, 1.15, 0.95] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function SealCeremony() {
  const sealFlow = useMemo(
    () => getSealFlowCopy(resolvePlatformTarget()),
    []
  );

  return (
    <div className="relative w-full max-w-md">
      <SealCelebrationParticles />
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-5 px-6 text-center"
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 1.2, ease: "easeOut" }}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#D4AF37] text-2xl text-black shadow-[0_0_36px_rgba(212,175,55,0.4)]"
          aria-hidden
        >
          ✓
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1.4, ease: "easeOut" }}
          className="text-4xl font-light tracking-tight text-white"
        >
          {sealFlow.successTitle}
        </motion.h1>
        {sealFlow.successMessage ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 1.2, ease: "easeOut" }}
            className="text-lg text-white/70"
          >
            {sealFlow.successMessage}
          </motion.p>
        ) : null}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 1 }}
          className="flex w-full max-w-xs flex-col gap-2.5 pt-4"
        >
          <Link
            href={APP_ENTRY_PATH}
            className="block rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            {sealFlow.successViewMemoriesCta}
          </Link>
          <Link
            href={`${APP_ENTRY_PATH}?open=new`}
            className="block rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white/75 transition-colors hover:border-white/40 hover:text-white"
          >
            {sealFlow.successSealAnotherCta}
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
