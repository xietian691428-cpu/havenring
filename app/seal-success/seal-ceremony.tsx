"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { getSealFlowCopy } from "@/src/content/havenCopy";
import { resolvePlatformTarget } from "@/src/hooks/usePlatformTarget";

export function SealCeremony() {
  const sealFlow = useMemo(
    () => getSealFlowCopy(resolvePlatformTarget()),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-6 px-6 text-center"
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
        className="text-3xl font-light tracking-tight text-white"
      >
        {sealFlow.successTitle}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 1.4, ease: "easeOut" }}
        className="max-w-sm text-lg text-white/75"
      >
        {sealFlow.successMessage}
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2, duration: 1.2 }}
      >
        <Link
          href="/app"
          className="text-xs tracking-[0.25em] uppercase text-white/40 hover:text-white/70 transition-colors"
        >
          Return
        </Link>
      </motion.div>
    </motion.div>
  );
}
