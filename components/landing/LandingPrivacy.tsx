"use client";

import { motion } from "framer-motion";
import { LandingFadeIn, landingEase } from "./LandingMotion";

const ITEMS = [
  {
    title: "Sealed with real cryptography",
    body: "Your memories deserve more than a pinky promise. What you seal is wrapped in encryption — intimacy backed by mathematics, not marketing.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-5 w-5">
        <path d="M12 11c-1.657 0-3-1.567-3-3.5V6a3 3 0 116 0v1.5c0 1.933-1.343 3.5-3 3.5z" />
        <path d="M6 10v8a2 2 0 002 2h8a2 2 0 002-2v-8" />
      </svg>
    ),
  },
  {
    title: "Shared only by invitation",
    body: "Nothing is public by default. If someone sees your world, it is because you opened the door — not because an algorithm kicked it in.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-5 w-5">
        <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
        <path d="M8 21v-1a4 4 0 014 0v1M16 21v-1a4 4 0 00-3-3.87" />
      </svg>
    ),
  },
  {
    title: "Your ritual is not content",
    body: "We did not build HavenRing to turn tenderness into traffic. Your sealed moments are not training data for a feed you never asked for.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-5 w-5">
        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.3 10.3 0 0112 5c4 0 7.4 2.5 9 6a10.1 10.1 0 01-1.5 2.7M6.3 6.3C4.3 7.8 3 10 3 12c0 2 1.2 4 3 5.5" />
        <path d="M9.88 9.88A3 3 0 0012 15c1.66 0 3-1.34 3-3 0-.47-.11-.91-.29-1.29" />
      </svg>
    ),
  },
  {
    title: "Your vault answers to you first",
    body: "Export, revoke, wipe — the frightening moves stay slow and deliberate. You stay at the center of your own archive.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" className="h-5 w-5">
        <path d="M4 7h16M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M9 11v6M15 11v6M10 17h4" />
      </svg>
    ),
  },
] as const;

export function LandingPrivacy() {
  return (
    <section className="scroll-mt-28 border-t border-white/[0.06] bg-black px-5 py-[clamp(4rem,11vw,7rem)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <LandingFadeIn>
          <p className="text-[10px] font-medium uppercase tracking-[0.48em] text-white/38">
            Built for privacy
          </p>
          <h2 className="mt-5 max-w-3xl text-balance text-[clamp(1.75rem,4vw,2.65rem)] font-medium leading-[1.14] tracking-[0.02em] text-white">
            Trust is not a bulleted list. It is the posture behind every decision we make.
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/45">
            Privacy here means dignity — the right to be earnest without an audience, and precise without a spreadsheet.
          </p>
        </LandingFadeIn>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-5">
          {ITEMS.map((item, i) => (
            <motion.article
              key={item.title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.75, delay: i * 0.07, ease: landingEase }}
              className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-950/95 to-black/80 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
            >
              <span className="text-amber-200/78">{item.icon}</span>
              <h3 className="text-[15px] font-medium leading-snug text-white/92">{item.title}</h3>
              <p className="text-[13px] leading-[1.72] text-white/48">{item.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
