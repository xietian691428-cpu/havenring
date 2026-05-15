import type { Metadata } from "next";
import Link from "next/link";
import { ShopChrome } from "@/components/shop/ShopChrome";

export const metadata: Metadata = {
  title: "Terms — HavenRing",
  description: "Terms of use for HavenRing products and services.",
};

export default function TermsPage() {
  return (
    <ShopChrome>
      <article className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-light tracking-tighter text-[#F5F5F5]">Terms of Use</h1>
        <p className="mt-6 text-[#AAAAAA] leading-relaxed">
          This page is being prepared. For questions about orders, returns, or product use, contact{" "}
          <a href="mailto:hello@havenring.me" className="text-[#D4AF37] hover:underline">
            hello@havenring.me
          </a>
          .
        </p>
        <p className="mt-4">
          <Link href="/privacy-policy" className="text-[#D4AF37] hover:underline">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/" className="text-[#AAAAAA] hover:text-[#F5F5F5]">
            Back to home
          </Link>
        </p>
      </article>
    </ShopChrome>
  );
}
