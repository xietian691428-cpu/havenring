import { SITE_ORIGIN } from "@/lib/site";
import {
  formatUsdFromCents,
  ringSizeLabel,
  ringStyleLabel,
} from "./catalog";
import type { ShopOrderRow } from "./orders";

function notifyEmail(): string {
  return (
    process.env.SHOP_ORDER_NOTIFY_EMAIL?.trim() ||
    process.env.SHOP_NOTIFY_EMAIL?.trim() ||
    "hello@havenring.me"
  );
}

function fromEmail(): string {
  return process.env.SHOP_EMAIL_FROM?.trim() || "HavenRing Orders <orders@havenring.me>";
}

async function sendViaResend(input: {
  to: string | string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail(),
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      text: input.text,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[shop-email] Resend failed:", res.status, err.slice(0, 400));
    return false;
  }
  return true;
}

function orderDetailsText(order: ShopOrderRow): string {
  return [
    `Order: ${order.order_ref}`,
    `Status: ${order.status}`,
    `Style: ${ringStyleLabel(order.style)}`,
    `Size: ${ringSizeLabel(order.ring_size)}`,
    `Quantity: ${order.quantity}`,
    `Total: ${formatUsdFromCents(order.amount_cents)} ${order.currency}`,
    `Email: ${order.email}`,
    order.customer_message ? `Message: ${order.customer_message}` : null,
    order.paypal_order_id ? `PayPal order: ${order.paypal_order_id}` : null,
    order.paypal_capture_id ? `PayPal capture: ${order.paypal_capture_id}` : null,
    `Placed: ${order.created_at}`,
    order.paid_at ? `Paid: ${order.paid_at}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function notifyMerchantNewPaidOrder(order: ShopOrderRow): Promise<void> {
  const text = [
    "New HavenRing shop order — please fulfill manually.",
    "",
    orderDetailsText(order),
    "",
    `Admin: ${SITE_ORIGIN}`,
  ].join("\n");

  const sent = await sendViaResend({
    to: notifyEmail(),
    subject: `[HavenRing] Paid order ${order.order_ref}`,
    text,
  });

  if (!sent) {
    console.info("[shop-email] Merchant notification (configure RESEND_API_KEY to email):\n", text);
  }
}

export async function notifyCustomerOrderConfirmed(order: ShopOrderRow): Promise<void> {
  const text = [
    "Thank you for your HavenRing order.",
    "",
    `Reference: ${order.order_ref}`,
    `${ringStyleLabel(order.style)} · ${ringSizeLabel(order.ring_size)} · Qty ${order.quantity}`,
    `Total paid: ${formatUsdFromCents(order.amount_cents)}`,
    "",
    "We will email you when your Ritual Ring ships. If you need to update your address, reply to this email.",
    "",
    `Questions: hello@havenring.me`,
    SITE_ORIGIN,
  ].join("\n");

  const sent = await sendViaResend({
    to: order.email,
    subject: `HavenRing order confirmed — ${order.order_ref}`,
    text,
  });

  if (!sent) {
    console.info("[shop-email] Customer confirmation skipped (no RESEND_API_KEY).");
  }
}
