"use client";

import type { ReactNode } from "react";
import { motion, type MotionProps } from "framer-motion";

export const landingEase = [0.22, 1, 0.36, 1] as const;

type FadeProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  duration?: number;
} & Omit<MotionProps, "children" | "className">;

export function LandingFadeIn({
  children,
  className,
  delay = 0,
  y = 24,
  duration = 0.85,
  ...rest
}: FadeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration, delay, ease: landingEase }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
