"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AMAZON_RITUAL_RING_URL } from "@/components/landing/constants";
import {
  computeOrderTotalCents,
  formatUsdFromCents,
  MAX_RING_QUANTITY,
  RING_SIZES,
  RING_STYLES,
  type RingSizeId,
  type RingStyleId,
} from "@/lib/shop/catalog";

type PayPalButtonsInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close: () => void;
};

type PayPalSdk = {
  Buttons: (config: {
    style?: { layout?: string; color?: string; shape?: string; label?: string };
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
  }) => PayPalButtonsInstance;
};

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

type Props = {
  paypalClientId: string | null;
};

export function CheckoutClient({ paypalClientId }: Props) {
  const router = useRouter();
  const paypalContainerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<PayPalButtonsInstance | null>(null);

  const [style, setStyle] = useState<RingStyleId>("matte-ceramic");
  const [ringSize, setRingSize] = useState<RingSizeId>("8");
  const [quantity, setQuantity] = useState(1);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [orderRef, setOrderRef] = useState("");
  const [paypalOrderId, setPaypalOrderId] = useState("");

  const totalCents = computeOrderTotalCents(quantity);
  const totalLabel = formatUsdFromCents(totalCents);

  useEffect(() => {
    if (!paypalClientId) return;
    if (document.querySelector('script[data-paypal-sdk="true"]')) {
      if (window.paypal) setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&intent=capture&disable-funding=paylater,card`;
    script.async = true;
    script.dataset.paypalSdk = "true";
    script.onload = () => setSdkReady(true);
    script.onerror = () => setError("Could not load PayPal. Try again or email hello@havenring.me.");
    document.body.appendChild(script);
  }, [paypalClientId]);

  const renderPayPalButtons = useCallback(async () => {
    if (!window.paypal || !paypalContainerRef.current || !paypalOrderId || !orderRef) return;

    buttonsRef.current?.close();
    paypalContainerRef.current.innerHTML = "";

    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "pill", label: "paypal" },
      createOrder: async () => paypalOrderId,
      onApprove: async (data) => {
        setBusy(true);
        setError("");
        try {
          const res = await fetch("/api/shop/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderRef,
              paypalOrderId: data.orderID,
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(payload.error || "Payment failed.");
          }
          router.push(`/checkout/success?ref=${encodeURIComponent(orderRef)}`);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Payment failed.");
          setBusy(false);
        }
      },
      onError: () => {
        setError("PayPal encountered an error. Please try again.");
        setBusy(false);
      },
      onCancel: () => {
        setBusy(false);
      },
    });

    buttonsRef.current = buttons;
    await buttons.render(paypalContainerRef.current);
  }, [orderRef, paypalOrderId, router]);

  useEffect(() => {
    if (checkoutReady && sdkReady) {
      void renderPayPalButtons();
    }
  }, [checkoutReady, sdkReady, renderPayPalButtons]);

  async function handlePrepareCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setCheckoutReady(false);

    try {
      const res = await fetch("/api/shop/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, ringSize, quantity, email, message }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || "Could not start checkout.");
      }
      setOrderRef(String(payload.orderRef || ""));
      setPaypalOrderId(String(payload.paypalOrderId || ""));
      setCheckoutReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!paypalClientId) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-6 py-8 text-center">
        <p className="text-sm leading-relaxed text-[#F5F5F5]/90">
          PayPal checkout is being configured. To order now, email{" "}
          <a href="mailto:hello@havenring.me" className="text-[#D4AF37] underline">
            hello@havenring.me
          </a>{" "}
          with your style, size, and quantity.
        </p>
        <a
          href={AMAZON_RITUAL_RING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-6 text-sm text-[#F5F5F5]"
        >
          Shop on Amazon instead
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.45em] text-[#D4AF37]">Checkout</p>
        <h1 className="mt-3 text-3xl font-light tracking-tighter text-[#F5F5F5]">Complete your order</h1>
        <p className="mt-3 text-sm text-[#AAAAAA]">
          We ship manually after payment — you will receive a confirmation email with your order
          reference.
        </p>
      </div>

      <form onSubmit={handlePrepareCheckout} className="space-y-6">
        <fieldset className="space-y-2" disabled={checkoutReady}>
          <legend className="text-sm font-medium text-[#F5F5F5]">Ring style</legend>
          {RING_STYLES.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer gap-3 rounded-lg border px-4 py-3 transition ${
                style === s.id
                  ? "border-[#D4AF37]/60 bg-[#D4AF37]/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name="style"
                value={s.id}
                checked={style === s.id}
                onChange={() => setStyle(s.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-[#F5F5F5]">{s.label}</span>
                <span className="mt-0.5 block text-xs text-[#666666]">{s.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#F5F5F5]">Ring size (US)</span>
            <select
              value={ringSize}
              onChange={(e) => setRingSize(e.target.value as RingSizeId)}
              disabled={checkoutReady}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-[#F5F5F5] outline-none focus:border-[#D4AF37]/50"
            >
              {RING_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#F5F5F5]">Quantity</span>
            <select
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              disabled={checkoutReady}
              className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-[#F5F5F5] outline-none focus:border-[#D4AF37]/50"
            >
              {Array.from({ length: MAX_RING_QUANTITY }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#F5F5F5]">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={checkoutReady}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-[#F5F5F5] placeholder:text-[#666666] outline-none focus:border-[#D4AF37]/50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#F5F5F5]">
            Note <span className="font-normal text-[#666666]">(optional)</span>
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={checkoutReady}
            rows={3}
            maxLength={2000}
            placeholder="Gift note, shipping preference, or sizing question…"
            className="w-full resize-y rounded-lg border border-white/15 bg-black/40 px-4 py-3 text-[#F5F5F5] placeholder:text-[#666666] outline-none focus:border-[#D4AF37]/50"
          />
        </label>

        <div className="flex items-center justify-between border-t border-white/[0.08] pt-6">
          <span className="text-sm text-[#AAAAAA]">Total</span>
          <span className="text-xl font-medium text-[#D4AF37]">{totalLabel}</span>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {!checkoutReady ? (
          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[52px] rounded-full bg-[#D4AF37] text-base font-medium text-black transition hover:bg-amber-300 disabled:opacity-60"
          >
            {busy ? "Preparing PayPal…" : "Continue to PayPal"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setCheckoutReady(false);
              setOrderRef("");
              setPaypalOrderId("");
              buttonsRef.current?.close();
            }}
            className="w-full min-h-11 rounded-full border border-white/25 text-sm text-[#AAAAAA] hover:text-[#F5F5F5]"
          >
            Edit order details
          </button>
        )}
      </form>

      {checkoutReady ? (
        <div className="space-y-4 border-t border-white/[0.08] pt-8">
          <p className="text-center text-sm text-[#AAAAAA]">
            Order <span className="text-[#D4AF37]">{orderRef}</span> — pay with PayPal below
          </p>
          <div ref={paypalContainerRef} className="min-h-[120px]" />
          {busy ? (
            <p className="text-center text-xs text-[#666666]">Confirming payment…</p>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-xs text-[#666666]">
        Prefer Amazon?{" "}
        <a
          href={AMAZON_RITUAL_RING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#D4AF37] underline-offset-2 hover:underline"
        >
          Shop on Amazon
        </a>
        {" · "}
        <Link href="/shop" className="text-[#AAAAAA] hover:text-[#F5F5F5]">
          Back to shop
        </Link>
      </p>
    </div>
  );
}
