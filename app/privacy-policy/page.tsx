import Link from "next/link";

/**
 * In-app privacy policy surface. Host full legal text here or replace with
 * NEXT_PUBLIC_PRIVACY_POLICY_URL in product links.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-2xl font-light tracking-tight text-stone-50">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-stone-400">
        Last updated: April 30, 2026
      </p>
      <p className="mt-4 text-sm leading-relaxed text-stone-300">
        At Haven, we believe your memories are deeply personal. We are committed
        to protecting your privacy with transparency and care.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">What we collect</h2>
        <ul className="list-disc pl-5 text-sm text-stone-300 space-y-2">
          <li>Account information (via Apple Sign In or Google Sign In)</li>
          <li>Memories you create (text, photos, videos, audio)</li>
          <li>Technical data (device type, IP address, app usage)</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">How we use your data</h2>
        <ul className="list-disc pl-5 text-sm text-stone-300 space-y-2">
          <li>To provide and improve your Memory Sanctuary</li>
          <li>To sync your memories across your devices</li>
          <li>To ensure security and prevent abuse</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Your data is end-to-end encrypted</h2>
        <p className="text-sm leading-relaxed text-stone-300">
          Your sealed memories are encrypted on your device before they leave
          your phone. We cannot read your content.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Data storage & retention</h2>
        <ul className="list-disc pl-5 text-sm text-stone-300 space-y-2">
          <li>Sealed memories are stored permanently until you delete your account.</li>
          <li>Drafts may be cleared after long periods of inactivity.</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Your rights</h2>
        <ul className="list-disc pl-5 text-sm text-stone-300 space-y-2">
          <li>Access, download, or delete your data at any time</li>
          <li>Revoke ring access instantly</li>
          <li>Request deletion of your account and all memories</li>
        </ul>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Third parties</h2>
        <p className="text-sm leading-relaxed text-stone-300">
          We do not sell your data. We only share anonymized technical data with
          service providers (e.g., Supabase for hosting and authentication) under
          strict agreements.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Children</h2>
        <p className="text-sm leading-relaxed text-stone-300">
          Haven is not intended for children under 13.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg text-stone-100">Contact</h2>
        <p className="text-sm leading-relaxed text-stone-300">
          If you have any questions, please contact us at{" "}
          <a className="text-amber-200 hover:text-amber-100" href="mailto:privacy@havenring.me">
            privacy@havenring.me
          </a>
          .
        </p>
      </section>

      <p className="mt-8 text-sm leading-relaxed text-stone-300">
        By using Haven, you agree to this Privacy Policy.
      </p>
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
