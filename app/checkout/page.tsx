import type { Metadata } from "next";
import { ShopChrome } from "@/components/shop/ShopChrome";
import { getPublicPayPalClientId } from "@/lib/shop/paypal";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout — HavenRing",
  description: "Order your Ritual Ring with PayPal. Style, size, and quantity.",
};

export default function CheckoutPage() {
  const paypalClientId = getPublicPayPalClientId();

  return (
    <ShopChrome>
      <CheckoutClient paypalClientId={paypalClientId} />
    </ShopChrome>
  );
}
