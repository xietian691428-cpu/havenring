import {
  computeOrderTotalCents,
  formatUsdFromCents,
  RITUAL_RING_CURRENCY,
  ringSizeLabel,
  ringStyleLabel,
} from "./catalog";
import type { CheckoutFormInput } from "./validate";

type PayPalAccessToken = { access_token: string };

function paypalApiBase(): string {
  const mode = (process.env.PAYPAL_MODE || "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function requirePayPalCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_NOT_CONFIGURED");
  }
  return { clientId, clientSecret };
}

export function getPublicPayPalClientId(): string | null {
  return process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID?.trim() || process.env.PAYPAL_CLIENT_ID?.trim() || null;
}

export function isPayPalConfigured(): boolean {
  try {
    requirePayPalCredentials();
    return Boolean(getPublicPayPalClientId());
  } catch {
    return false;
  }
}

async function getPayPalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = requirePayPalCredentials();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as PayPalAccessToken;
  if (!json.access_token) throw new Error("PayPal auth returned no token.");
  return json.access_token;
}

export async function createPayPalCheckoutOrder(
  input: CheckoutFormInput & { orderRef: string }
): Promise<string> {
  const token = await getPayPalAccessToken();
  const amountCents = computeOrderTotalCents(input.quantity);
  const value = (amountCents / 100).toFixed(2);
  const description = `HavenRing Ritual Ring ×${input.quantity} — ${ringStyleLabel(input.style)}, ${ringSizeLabel(input.ringSize)}`;

  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.orderRef,
          custom_id: input.orderRef,
          description: description.slice(0, 127),
          amount: {
            currency_code: RITUAL_RING_CURRENCY,
            value,
            breakdown: {
              item_total: {
                currency_code: RITUAL_RING_CURRENCY,
                value,
              },
            },
          },
          items: [
            {
              name: "HavenRing Ritual Ring",
              description: `${ringStyleLabel(input.style)} · ${ringSizeLabel(input.ringSize)}`,
              unit_amount: {
                currency_code: RITUAL_RING_CURRENCY,
                value: (amountCents / input.quantity / 100).toFixed(2),
              },
              quantity: String(input.quantity),
              category: "PHYSICAL_GOODS",
            },
          ],
        },
      ],
      application_context: {
        brand_name: "HavenRing",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal create order failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("PayPal did not return an order id.");
  return json.id;
}

export type PayPalCaptureResult = {
  captureId: string;
  payerEmail: string | null;
  amount: string;
};

export async function capturePayPalOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${paypalApiBase()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal capture failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    payer?: { email_address?: string };
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{ id?: string; amount?: { value?: string } }>;
      };
    }>;
  };

  const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture?.id) {
    throw new Error("PayPal capture response missing capture id.");
  }

  return {
    captureId: capture.id,
    payerEmail: json.payer?.email_address ?? null,
    amount: capture.amount?.value ?? "",
  };
}

export function formatOrderSummaryForPayPal(input: CheckoutFormInput): string {
  const cents = computeOrderTotalCents(input.quantity);
  return `${ringStyleLabel(input.style)}, size ${ringSizeLabel(input.ringSize)}, qty ${input.quantity} — ${formatUsdFromCents(cents)}`;
}
