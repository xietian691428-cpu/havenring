"use client";

import Link from "next/link";
import { getPreferredLocale } from "@/lib/i18n";
import { getPrivacyPolicyContent } from "./privacyPolicyContent";

/**
 * In-app privacy policy surface. Host full legal text here or replace with
 * NEXT_PUBLIC_PRIVACY_POLICY_URL in product links.
 */
export default function PrivacyPolicyPage() {
  const locale = getPreferredLocale();
  const t = getPrivacyPolicyContent(locale);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-100 px-6 py-16 max-w-2xl mx-auto">
      <h1 className="text-2xl font-light tracking-tight text-stone-50">
        {t.title}
      </h1>
      <p className="mt-2 text-xs uppercase tracking-widest text-stone-400">
        {t.lastUpdated}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-stone-300">
        {t.intro}
      </p>

      {t.sections.map((section) => (
        <section key={section.heading} className="mt-8 space-y-3">
          <h2 className="text-lg text-stone-100">{section.heading}</h2>
          {section.body ? (
            <p className="text-sm leading-relaxed text-stone-300">
              {section.body.includes("privacy@havenring.me") ? (
                <>
                  {section.body.replace("privacy@havenring.me", "")}
                  <a
                    className="text-amber-200 hover:text-amber-100"
                    href="mailto:privacy@havenring.me"
                  >
                    privacy@havenring.me
                  </a>
                </>
              ) : (
                section.body
              )}
            </p>
          ) : null}
          {section.bullets?.length ? (
            <ul className="list-disc pl-5 text-sm text-stone-300 space-y-2">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <p className="mt-8 text-sm leading-relaxed text-stone-300">
        {t.closing}
      </p>
      <div className="mt-10">
        <Link
          href="/"
          className="text-sm tracking-widest uppercase text-amber-200/90 hover:text-amber-100"
        >
          {t.returnLabel}
        </Link>
      </div>
    </main>
  );
}
