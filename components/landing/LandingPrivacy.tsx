const ITEMS = [
  {
    title: "End-to-end encrypted",
    body: "Your sealed moments are protected with modern encryption.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M12 11c-1.657 0-3-1.567-3-3.5V6a3 3 0 116 0v1.5c0 1.933-1.343 3.5-3 3.5z" />
        <path d="M6 10v8a2 2 0 002 2h8a2 2 0 002-2v-8" />
      </svg>
    ),
  },
  {
    title: "Only shared by invitation",
    body: "Nothing is public unless you choose to invite someone in.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M16 11a4 4 0 10-8 0 4 4 0 008 0z" />
        <path d="M8 21v-1a4 4 0 014 0v1M16 21v-1a4 4 0 00-3-3.87" />
      </svg>
    ),
  },
  {
    title: "No cloud exposure",
    body: "Designed so your ritual stays yours — not a billboard.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.3 10.3 0 0112 5c4 0 7.4 2.5 9 6a10.1 10.1 0 01-1.5 2.7M6.3 6.3C4.3 7.8 3 10 3 12c0 2 1.2 4 3 5.5" />
        <path d="M9.88 9.88A3 3 0 0012 15c1.66 0 3-1.34 3-3 0-.47-.11-.91-.29-1.29" />
      </svg>
    ),
  },
  {
    title: "You're always in control",
    body: "Export, revoke, or wipe — high-risk actions stay gated.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
        <path d="M4 7h16M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2M9 11v6M15 11v6M10 17h4" />
      </svg>
    ),
  },
] as const;

export function LandingPrivacy() {
  return (
    <section className="border-t border-white/[0.06] bg-black px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-medium tracking-[0.45em] text-white/40">
          BUILT FOR PRIVACY
        </p>
        <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Trust is not a feature list. It is the reason we exist.
        </h2>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-zinc-950/80 p-6 backdrop-blur-sm"
            >
              <span className="text-amber-200/85">{item.icon}</span>
              <h3 className="text-sm font-medium text-white/92">{item.title}</h3>
              <p className="text-sm leading-relaxed text-white/50">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
