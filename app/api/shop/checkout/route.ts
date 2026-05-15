import { NextRequest, NextResponse } from "next/server";
import { API_RATE_POLICIES, enforceIpRateLimit } from "@/lib/api-rate-limit";
import { buildOrderRef, insertPendingShopOrder } from "@/lib/shop/orders";
import { createPayPalCheckoutOrder, isPayPalConfigured } from "@/lib/shop/paypal";
import { parseCheckoutBody } from "@/lib/shop/validate";
import { computeOrderTotalCents, formatUsdFromCents } from "@/lib/shop/catalog";

export async function POST(req: NextRequest) {
  try {
    const limitRes = await enforceIpRateLimit({
      req,
      scope: "shop-checkout",
      policy: { maxRequests: 12, windowMs: 60_000 },
    });
    if (limitRes) return limitRes;

    if (!isPayPalConfigured()) {
      return NextResponse.json(
        {
          error: "PayPal checkout is not configured yet. Please email hello@havenring.me to order.",
          error_code: "PAYPAL_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseCheckoutBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, error_code: "INVALID_INPUT" }, { status: 400 });
    }

    const orderRef = buildOrderRef();
    const paypalOrderId = await createPayPalCheckoutOrder({
      ...parsed.data,
      orderRef,
    });

    const order = await insertPendingShopOrder({
      orderRef,
      style: parsed.data.style,
      ringSize: parsed.data.ringSize,
      quantity: parsed.data.quantity,
      email: parsed.data.email,
      message: parsed.data.message,
      paypalOrderId,
    });

    return NextResponse.json({
      orderRef: order.order_ref,
      paypalOrderId,
      amountCents: computeOrderTotalCents(parsed.data.quantity),
      amountLabel: formatUsdFromCents(order.amount_cents),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed.";
    if (message === "PAYPAL_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "PayPal is not configured.", error_code: "PAYPAL_NOT_CONFIGURED" },
        { status: 503 }
      );
    }
    console.error("[shop/checkout]", message);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again.", error_code: "CHECKOUT_FAILED" },
      { status: 500 }
    );
  }
}
