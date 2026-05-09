const STEPS = [
  {
    title: "Write",
    body: "Capture a thought, memory, or feeling that matters.",
    hint: "Journal",
  },
  {
    title: "Touch",
    body: "Tap your ring on your phone to seal your moment.",
    hint: "NFC",
  },
  {
    title: "Seal",
    body: "Your moment is encrypted and stored privately.",
    hint: "Lock",
  },
  {
    title: "Treasure",
    body: "Revisit your sealed moments whenever you want.",
    hint: "Vault",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section className="border-t border-white/[0.06] bg-[#050506] px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-medium tracking-[0.45em] text-white/40">
          HOW IT WORKS
        </p>
        <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Write → Touch → Seal → Treasure
        </h2>

        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:gap-12">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-5">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[10px] tracking-[0.2em] text-amber-200/90">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[9px] uppercase tracking-[0.25em] text-white/30">
                  {step.hint}
                </span>
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-medium text-white">{step.title}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-white/55">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
