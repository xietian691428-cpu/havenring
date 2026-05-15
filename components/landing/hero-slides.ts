/**
 * Hero background carousel — add 3–5 high-res images under public/landing/
 * and list them here (object-cover, full-bleed).
 */
export type HeroSlide = {
  src: string;
  alt: string;
  /** Optional short line over the image (kept subtle). */
  caption?: string;
};

export const HERO_CAROUSEL_SLIDES: HeroSlide[] = [
  {
    src: "/landing/hero-slide-1.png",
    alt: "Hand holding the HavenRing against a warm golden-hour family moment",
    caption: "For the moments you never want to lose.",
  },
  {
    src: "/landing/hero-mood.png",
    alt: "Warm cinematic mood — memory and presence",
  },
  {
    src: "/landing/brand-poster-v2.png",
    alt: "HavenRing ritual ring and sanctuary",
  },
];

export const HERO_AUTO_ADVANCE_MS = 7000;
