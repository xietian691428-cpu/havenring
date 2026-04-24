"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function SealCeremony() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-8"
    >
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 1.4, ease: "easeOut" }}
        className="h-px w-32 bg-white/80"
      />
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 1.6, ease: "easeOut" }}
        className="text-3xl font-light tracking-[0.3em] uppercase"
      >
        Sealed forever
      </motion.h1>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2, duration: 1.2 }}
      >
        <Link
          href="/"
          className="text-xs tracking-[0.25em] uppercase text-white/40 hover:text-white/70 transition-colors"
        >
          Return
        </Link>
      </motion.div>
    </motion.div>
  );
}
