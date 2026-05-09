const QUOTES = [
  {
    quote: "Beautiful, private, and meaningful.",
    name: "Alex",
    locale: "USA",
  },
  {
    quote: "Finally, something just for us.",
    name: "Sarah",
    locale: "UK",
  },
] as const;

export function LandingTestimonials() {
  return (
    <section className="border-t border-white/[0.06] bg-black px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[10px] font-medium tracking-[0.45em] text-white/35">
          FROM PEOPLE WHO WANT QUIET
        </p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-8">
          {QUOTES.map((q) => (
            <figure
              key={q.name}
              className="flex flex-col gap-4 border border-white/[0.06] bg-white/[0.02] px-8 py-10"
            >
              <div className="flex gap-0.5 text-amber-200/70" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="text-sm">
                    ★
                  </span>
                ))}
              </div>
              <blockquote className="text-lg font-light leading-relaxed text-white/85">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="text-xs tracking-[0.2em] text-white/40">
                {q.name}, {q.locale}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
