export const RITUAL_RING_UNIT_PRICE_CENTS = 4900;
export const RITUAL_RING_CURRENCY = "USD";

export const RING_STYLES = [
  {
    id: "matte-ceramic",
    label: "Matte Ceramic — Signature",
    description: "Soft matte finish, everyday wear, NFC at the heart.",
  },
  {
    id: "warm-sand",
    label: "Warm Sand — Limited",
    description: "Warmer ceramic tone, same ritual NFC core.",
  },
] as const;

export type RingStyleId = (typeof RING_STYLES)[number]["id"];

export const RING_SIZES = [
  { id: "6", label: "US 6" },
  { id: "7", label: "US 7" },
  { id: "8", label: "US 8" },
  { id: "9", label: "US 9" },
  { id: "10", label: "US 10" },
  { id: "11", label: "US 11" },
  { id: "12", label: "US 12" },
] as const;

export type RingSizeId = (typeof RING_SIZES)[number]["id"];

export const MAX_RING_QUANTITY = 5;

export function ringStyleLabel(styleId: string): string {
  return RING_STYLES.find((s) => s.id === styleId)?.label ?? styleId;
}

export function ringSizeLabel(sizeId: string): string {
  return RING_SIZES.find((s) => s.id === sizeId)?.label ?? sizeId;
}

export function computeOrderTotalCents(quantity: number): number {
  return RITUAL_RING_UNIT_PRICE_CENTS * quantity;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: RITUAL_RING_CURRENCY,
  }).format(cents / 100);
}
