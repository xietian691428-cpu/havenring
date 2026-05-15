import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { computeOrderTotalCents, RITUAL_RING_CURRENCY } from "./catalog";

export type ShopOrderRow = {
  id: string;
  order_ref: string;
  style: string;
  ring_size: string;
  quantity: number;
  email: string;
  customer_message: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  created_at: string;
  paid_at: string | null;
};

function randomRefSuffix(): string {
  return Math.random().toString(16).slice(2, 6).toUpperCase();
}

export function buildOrderRef(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `HR-${y}${m}${d}-${randomRefSuffix()}`;
}

export async function insertPendingShopOrder(input: {
  orderRef: string;
  style: string;
  ringSize: string;
  quantity: number;
  email: string;
  message: string;
  paypalOrderId: string;
}): Promise<ShopOrderRow> {
  const admin = getSupabaseAdminClient();
  const orderRef = input.orderRef;
  const amountCents = computeOrderTotalCents(input.quantity);

  const { data, error } = await admin
    .from("shop_orders" as never)
    .insert({
      order_ref: orderRef,
      style: input.style,
      ring_size: input.ringSize,
      quantity: input.quantity,
      email: input.email,
      customer_message: input.message || null,
      amount_cents: amountCents,
      currency: RITUAL_RING_CURRENCY,
      status: "pending",
      paypal_order_id: input.paypalOrderId,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not create order.");
  }
  return data as ShopOrderRow;
}

export async function getShopOrderByRef(orderRef: string): Promise<ShopOrderRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("shop_orders" as never)
    .select("*")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShopOrderRow | null) ?? null;
}

export async function getShopOrderByPaypalOrderId(
  paypalOrderId: string
): Promise<ShopOrderRow | null> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("shop_orders" as never)
    .select("*")
    .eq("paypal_order_id", paypalOrderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ShopOrderRow | null) ?? null;
}

export async function markShopOrderPaid(input: {
  orderRef: string;
  paypalCaptureId: string;
}): Promise<ShopOrderRow> {
  const admin = getSupabaseAdminClient();
  const paidAt = new Date().toISOString();
  const { data, error } = await admin
    .from("shop_orders" as never)
    .update({
      status: "paid",
      paypal_capture_id: input.paypalCaptureId,
      paid_at: paidAt,
    } as never)
    .eq("order_ref", input.orderRef)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Could not update order.");
  }
  return data as ShopOrderRow;
}
