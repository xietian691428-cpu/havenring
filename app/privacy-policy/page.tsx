import Link from "next/link";

/**
 * In-app privacy policy surface. Host full legal text here or replace with
 * NEXT_PUBLIC_PRIVACY_POLICY_URL in product links.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-2xl font-light tracking-tight text-stone-50">
        Privacy & data
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-stone-300">
        Haven Ring is designed for a private memory space. Sealed content is
        encrypted; we do not use NFC tag UIDs as naked identifiers in our
        database — we store only secure fingerprints. Binding and revoking
        rings, optional cloud features, and any future digital-legacy options
        are described in your region-specific policy when you go live. Replace
        this page with your counsel-approved text and data-residency addenda
        (GDPR / CCPA) before production.
      </p>
      <ul className="mt-6 list-disc pl-5 text-sm text-stone-400 space-y-2">
        <li>Export and delete rights supported at the account level where applicable.</li>
        <li>Revoke a lost ring from a trusted signed-in device.</li>
        <li>No claim that the physical ring alone is your account.</li>
      </ul>
      <div className="mt-10">
        <Link
          href="/"
          className="text-sm tracking-widest uppercase text-amber-200/90 hover:text-amber-100"
        >
          Return
        </Link>
      </div>
    </main>
  );
}
