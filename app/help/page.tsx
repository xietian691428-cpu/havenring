"use client";

import Link from "next/link";
import { getPreferredLocale, getTranslator } from "@/lib/i18n";

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
