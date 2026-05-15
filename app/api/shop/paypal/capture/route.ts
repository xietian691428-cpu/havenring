import { NextRequest, NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/api-rate-limit";
import {
  getShopOrderByPaypalOrderId,
  getShopOrderByRef,
  markShopOrderPaid,
} from "@/lib/shop/orders";
import { capturePayPalOrder } from "@/lib/shop/paypal";
import { notifyCustomerOrderConfirmed, notifyMerchantNewPaidOrder } from "@/lib/shop/email";

type CaptureBody = {
  orderRef?: unknown;
  paypalOrderId?: unknown;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as CaptureBody;
  const orderRef = String(body.orderRef ?? "").trim();
  const paypalOrderId = String(body.paypalOrderId ?? "").trim();

  try {
    const limitRes = await enforceIpRateLimit({
      req,
      scope: "shop-capture",
      policy: { maxRequests: 20, windowMs: 60_000 },
    });
    if (limitRes) return limitRes;

    if (!orderRef || !paypalOrderId) {
      return NextResponse.json(
        { error: "Missing order reference.", error_code: "INVALID_INPUT" },
        { status: 400 }
      );
    }

    const existing = await getShopOrderByRef(orderRef);
    if (!existing) {
      return NextResponse.json({ error: "Order not found.", error_code: "NOT_FOUND" }, { status: 404 });
    }
    if (existing.paypal_order_id !== paypalOrderId) {
      return NextResponse.json(
        { error: "Order mismatch.", error_code: "ORDER_MISMATCH" },
        { status: 400 }
      );
    }
    if (existing.status === "paid") {
      return NextResponse.json({
        orderRef: existing.order_ref,
        status: "paid",
        alreadyPaid: true,
      });
    }

    const capture = await capturePayPalOrder(paypalOrderId);
    const paid = await markShopOrderPaid({
      orderRef,
      paypalCaptureId: capture.captureId,
    });

    await Promise.all([
      notifyMerchantNewPaidOrder(paid),
      notifyCustomerOrderConfirmed(paid),
    ]);

    return NextResponse.json({
      orderRef: paid.order_ref,
      status: "paid",
      captureId: capture.captureId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Capture failed.";
    console.error("[shop/paypal/capture]", message);

    if (paypalOrderId) {
      const row = await getShopOrderByPaypalOrderId(paypalOrderId).catch(() => null);
      if (row?.status === "paid") {
        return NextResponse.json({
          orderRef: row.order_ref,
          status: "paid",
          alreadyPaid: true,
        });
      }
    }

    return NextResponse.json(
      { error: "Payment could not be completed. Contact hello@havenring.me with your order reference.", error_code: "CAPTURE_FAILED" },
      { status: 500 }
    );
  }
}
