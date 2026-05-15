import {
  MAX_RING_QUANTITY,
  RING_SIZES,
  RING_STYLES,
  type RingSizeId,
  type RingStyleId,
} from "./catalog";

export type CheckoutFormInput = {
  style: RingStyleId;
  ringSize: RingSizeId;
  quantity: number;
  email: string;
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCheckoutBody(body: unknown):
  | { ok: true; data: CheckoutFormInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }
  const raw = body as Record<string, unknown>;
  const style = String(raw.style ?? "").trim();
  const ringSize = String(raw.ringSize ?? raw.ring_size ?? "").trim();
  const quantity = Number(raw.quantity ?? 1);
  const email = String(raw.email ?? "").trim().toLowerCase();
  const message = String(raw.message ?? raw.customer_message ?? "").trim();

  if (!RING_STYLES.some((s) => s.id === style)) {
    return { ok: false, error: "Please choose a ring style." };
  }
  if (!RING_SIZES.some((s) => s.id === ringSize)) {
    return { ok: false, error: "Please choose a ring size." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_RING_QUANTITY) {
    return { ok: false, error: `Quantity must be between 1 and ${MAX_RING_QUANTITY}.` };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Message is too long (max 2000 characters)." };
  }

  return {
    ok: true,
    data: {
      style: style as RingStyleId,
      ringSize: ringSize as RingSizeId,
      quantity,
      email,
      message,
    },
  };
}
