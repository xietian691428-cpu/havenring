"use client";

import Link from "next/link";
import { getPreferredLocale, getTranslator } from "@/lib/i18n";

const howHavenWorksRows = [
  ["Open the app daily", "No", "Touch your ring or use Face ID"],
  ["Quick notes & drafts", "No", "Just start writing"],
  ["Seal an important memory", "Yes", "Seal with Ring"],
  ["Add or remove a ring", "Yes", "Face ID confirmation"],
  ["Export data", "Yes", "Face ID confirmation"],
  ["Delete sealed memories", "Yes", "Face ID + extra confirmation"],
  ["Handle a lost ring", "No", "Revoke from any signed-in device"],
];

const keyPoints = [
  "1. The dynamic NFC ring is the ceremony key for memories that matter.",
  "2. Face ID protects the account and remains the secure fallback.",
  "3. Sealing a sacred memory requires a trusted physical ring touch.",
  "4. High-risk actions typically require secondary verification.",
  "5. Sealed memories are encrypted, final, and intentionally quiet.",
];

export default function HelpPage() {
  const locale = getPreferredLocale();
  const t = getTranslator(locale);

  return (
    <main className="flex flex-1 w-full items-center justify-center px-6 py-16 bg-black text-white">
      <section className="w-full max-w-2xl flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <p className="text-xs tracking-[0.3em] uppercase text-white/40">
            Haven
          </p>
          <h1 className="text-2xl font-light leading-relaxed text-white/90">
            {t("help.title")}
          </h1>
        </header>

        <article className="flex flex-col gap-8 border border-white/10 bg-white/[0.02] p-6">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm tracking-[0.22em] uppercase text-white/80">
                How Haven Works
              </h2>
              <p className="text-sm leading-relaxed text-white/70">
                Your Face ID protects your account. Your ring gives you fast
                access and a special ritual for your most precious memories.
              </p>
            </div>

            <div className="overflow-x-auto border border-white/10">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                <thead className="bg-white/[0.04] text-white/70">
                  <tr>
                    <th className="border-b border-white/10 px-3 py-2 font-medium">
                      What you want to do
                    </th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium">
                      Ring required
                    </th>
                    <th className="border-b border-white/10 px-3 py-2 font-medium">
                      Recommended
                    </th>
                  </tr>
                </thead>
                <tbody className="text-white/65">
                  {howHavenWorksRows.map(([action, required, recommended]) => (
                    <tr key={action}>
                      <td className="border-b border-white/10 px-3 py-2">
                        {action}
                      </td>
                      <td className="border-b border-white/10 px-3 py-2">
                        {required}
                      </td>
                      <td className="border-b border-white/10 px-3 py-2">
                        {recommended}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-xs tracking-[0.22em] uppercase text-white/70">
                Five Key Points
              </h3>
              {keyPoints.map((point) => (
                <p key={point} className="text-sm leading-relaxed text-white/65">
                  {point}
                </p>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm tracking-[0.22em] uppercase text-white/80">
              {t("help.local_only.title")}
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {t("help.local_only.body")}
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm tracking-[0.22em] uppercase text-white/80">
              {t("help.recovery.title")}
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {t("help.recovery.body")}
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm tracking-[0.22em] uppercase text-white/80">
              {t("help.optional_cloud.title")}
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              {t("help.optional_cloud.body")}
            </p>
          </section>
        </article>

        <div className="flex items-center justify-end">
          <Link
            href="/"
            className="text-sm tracking-[0.24em] uppercase text-white/75 hover:text-white transition-colors"
          >
            {t("common.return")}
          </Link>
        </div>
      </section>
    </main>
  );
}
