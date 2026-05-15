import type { Metadata } from "next";
import Link from "next/link";
import { ShopChrome } from "@/components/shop/ShopChrome";
import {
  formatUsdFromCents,
  ringSizeLabel,
  ringStyleLabel,
} from "@/lib/shop/catalog";
import { getShopOrderByRef } from "@/lib/shop/orders";

export const metadata: Metadata = {
  title: "Order confirmed — HavenRing",
  description: "Thank you for your HavenRing order.",
};

type Props = {
  searchParams: Promise<{ ref?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const { ref: orderRef = "" } = await searchParams;
  const order = orderRef ? await getShopOrderByRef(orderRef).catch(() => null) : null;

  return (
    <ShopChrome>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">
          Thank you
        </p>
        <h1 className="mt-4 text-3xl font-light tracking-tighter text-[#F5F5F5]">
          Your ritual is on its way.
        </h1>
        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-[#AAAAAA]">
          {order?.status === "paid"
            ? "Payment received. We will prepare and ship your ring manually — watch for a shipping email."
            : orderRef
              ? "If you completed PayPal, your confirmation email should arrive shortly."
              : "Your order reference was not found. If you paid, contact us with your PayPal receipt."}
        </p>

        {order ? (
          <dl className="mx-auto mt-10 max-w-sm space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-6 py-6 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#666666]">Reference</dt>
              <dd className="font-medium text-[#D4AF37]">{order.order_ref}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#666666]">Style</dt>
              <dd className="text-[#F5F5F5]">{ringStyleLabel(order.style)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#666666]">Size</dt>
              <dd className="text-[#F5F5F5]">{ringSizeLabel(order.ring_size)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#666666]">Quantity</dt>
              <dd className="text-[#F5F5F5]">{order.quantity}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-white/[0.08] pt-3">
              <dt className="text-[#666666]">Total</dt>
              <dd className="text-[#F5F5F5]">{formatUsdFromCents(order.amount_cents)}</dd>
            </div>
          </dl>
        ) : orderRef ? (
          <p className="mt-8 text-sm text-[#AAAAAA]">
            Reference: <span className="text-[#D4AF37]">{orderRef}</span>
          </p>
        ) : null}

        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#D4AF37] px-8 text-sm font-medium text-black hover:bg-amber-300"
          >
            Open App
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-8 text-sm text-[#F5F5F5] hover:border-white/70"
          >
            Back to home
          </Link>
        </div>

        <p className="mt-10 text-xs text-[#666666]">
          Questions?{" "}
          <a href="mailto:hello@havenring.me" className="text-[#D4AF37] hover:underline">
            hello@havenring.me
          </a>
        </p>
      </div>
    </ShopChrome>
  );
}
