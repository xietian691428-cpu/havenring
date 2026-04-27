"use client";

import { useEffect, useState } from "react";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getTranslator,
  isSupportedLocale,
  setPreferredLocale,
  type Locale,
} from "@/lib/i18n";

const LABELS: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
  es: "ES",
  de: "DE",
  it: "IT",
};

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const t = getTranslator(locale);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    if (isSupportedLocale(lang)) {
      setLocale(lang);
      return;
    }
    const saved = window.localStorage.getItem("haven.locale");
    if (isSupportedLocale(saved)) {
      setLocale(saved);
      return;
    }
    setLocale(DEFAULT_LOCALE);
  }, []);

  function handleChange(next: string) {
    if (!isSupportedLocale(next)) return;
    setLocale(next);
    setPreferredLocale(next);
    const params = new URLSearchParams(window.location.search);
    params.set("lang", next);
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.location.assign(nextUrl);
  }

  return (
    <label
      className="fixed left-4 z-[100] flex items-center gap-2 rounded-full border border-white/30 bg-black/70 px-3 py-1.5 text-[11px] tracking-[0.16em] text-white/90 backdrop-blur-sm"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
    >
      <span>{t("common.lang")}</span>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-white outline-none"
        aria-label={t("common.language_aria")}
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l} className="bg-black text-white">
            {LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
