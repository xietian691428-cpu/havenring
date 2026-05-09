import Image from "next/image";

export function LandingRitual() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_100%,rgba(120,90,50,0.2),transparent_55%)]" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="order-2 lg:order-1">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-zinc-950 shadow-[0_60px_120px_-50px_rgba(0,0,0,0.9)]">
            <Image
              src="/landing/hero-mood.png"
              alt="HavenRing on a dark surface, soft rim light"
              fill
              sizes="(max-width:1024px) 100vw, 50vw"
              className="object-cover object-center opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/50 via-transparent to-black/30" />
          </div>
        </div>
        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <p className="text-[10px] font-medium tracking-[0.45em] text-amber-200/70">
            THE RITUAL
          </p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Not everything needs to be shared.
          </h2>
          <p className="max-w-lg text-pretty leading-relaxed text-white/58">
            Some moments deserve silence, warmth, and a small ceremony. HavenRing is a
            physical reminder to protect what is tender — a quiet boundary between your
            inner life and the noise of the feed.
          </p>
          <p className="max-w-lg text-pretty leading-relaxed text-white/45">
            When you are ready, one touch turns intention into something sealed — yours,
            encrypted, and kept.
          </p>
        </div>
      </div>
    </section>
  );
}
