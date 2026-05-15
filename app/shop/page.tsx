import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AMAZON_RITUAL_RING_URL } from "@/components/landing/constants";
import { ShopChrome } from "@/components/shop/ShopChrome";
import {
  formatUsdFromCents,
  RING_STYLES,
  RITUAL_RING_UNIT_PRICE_CENTS,
} from "@/lib/shop/catalog";

export const metadata: Metadata = {
  title: "Shop — Ritual Ring",
  description: "Order the HavenRing Ritual Ring. PayPal checkout, manual fulfillment with care.",
};

export default function ShopPage() {
  return (
    <ShopChrome>
      <div className="relative mb-10 aspect-[16/10] overflow-hidden rounded-lg border border-white/[0.08]">
        <Image
          src="/landing/hero-slide-1.png"
          alt="HavenRing Ritual Ring"
          fill
          priority
          sizes="(max-width:768px) 100vw, 672px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/40 to-transparent" />
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">The Ring</p>
      <h1 className="mt-4 text-3xl font-light tracking-tighter text-[#F5F5F5] md:text-4xl">
        Ritual Ring
      </h1>
      <p className="mt-2 text-xl text-[#D4AF37]">
        {formatUsdFromCents(RITUAL_RING_UNIT_PRICE_CENTS)}
      </p>
      <p className="mt-6 text-base leading-relaxed text-[#AAAAAA]">
        A matte ceramic body with NFC at the heart — jewelry that unlocks your private sanctuary.
        Each ring is prepared and shipped by hand after you order.
      </p>

      <ul className="mt-8 space-y-3 border-t border-white/[0.08] pt-8 text-sm text-[#AAAAAA]">
        {RING_STYLES.map((style) => (
          <li key={style.id}>
            <span className="text-[#F5F5F5]">{style.label}</span>
            <span className="mt-1 block text-[#666666]">{style.description}</span>
          </li>
        ))}
      </ul>

      <div className="mt-12 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/checkout"
          className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-full bg-[#D4AF37] px-8 text-base font-medium text-black transition hover:bg-amber-300"
        >
          Checkout with PayPal
        </Link>
        <a
          href={AMAZON_RITUAL_RING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[52px] flex-1 items-center justify-center rounded-full border border-white/40 px-8 text-base font-medium text-[#F5F5F5] transition hover:border-white/70"
        >
          Shop on Amazon
        </a>
      </div>

      <p className="mt-8 text-center text-xs leading-relaxed text-[#666666]">
        Free shipping worldwide on direct orders · 30-day ritual guarantee · PayPal secure payment
      </p>
    </ShopChrome>
  );
}
