import Image from "next/image";
import Link from "next/link";

export function ShopChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <header className="border-b border-white/[0.08] px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-xs tracking-[0.25em] text-[#AAAAAA] transition hover:text-[#F5F5F5]"
          >
            ← HavenRing
          </Link>
          <Link
            href="/"
            className="relative block h-6 w-[120px] overflow-hidden opacity-90"
            aria-label="HavenRing home"
          >
            <Image
              src="/landing/brand-poster-v2.png"
              alt=""
              fill
              sizes="120px"
              className="object-cover object-[14%_10%]"
            />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
    </div>
  );
}
