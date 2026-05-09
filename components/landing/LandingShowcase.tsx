export function LandingShowcase() {
  return (
    <section className="relative border-t border-white/[0.06] bg-black px-6 py-20 sm:py-28">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        <div className="flex max-w-xl flex-1 flex-col gap-6">
          <p className="text-[10px] font-medium tracking-[0.45em] text-amber-200/75">
            CAPTURE · SEAL · TREASURE
          </p>
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            No feeds. No followers. Just your world.
          </h2>
          <p className="text-pretty leading-relaxed text-white/58">
            HavenRing helps you capture meaningful moments and seal them with a touch.
            Write what matters, tap your ring, and keep it somewhere worthy of the memory.
          </p>
        </div>

        <div className="relative flex flex-1 justify-center">
          <div className="relative aspect-[9/19] w-[min(100%,280px)] overflow-hidden rounded-[2.2rem] border border-white/10 bg-zinc-950 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.85)]">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-9 bg-black/80 backdrop-blur-sm"
            />
            <div className="flex h-full flex-col px-5 pb-8 pt-14">
              <p className="text-center text-[11px] tracking-[0.16em] text-white/45">
                Write your moment
              </p>
              <div className="mt-4 flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="text-sm italic leading-relaxed text-white/68">
                  &ldquo;The way you looked at me when we thought no one was watching.&rdquo;
                </p>
              </div>
              <div className="mt-8 flex flex-col items-center gap-4">
                <div className="h-16 w-16 rounded-full border border-amber-400/25 bg-gradient-to-b from-amber-400/15 to-transparent shadow-[0_0_40px_-10px_rgba(245,180,100,0.35)]" />
                <p className="text-center text-[10px] tracking-[0.2em] text-white/45">
                  Touch your ring to seal it
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
