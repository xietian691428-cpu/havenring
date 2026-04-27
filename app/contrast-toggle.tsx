"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, getPreferredLocale, getTranslator, type Locale } from "@/lib/i18n";

const STORAGE_KEY = "haven.high_contrast";

export function ContrastToggle() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [enabled, setEnabled] = useState(true);
  const t = getTranslator(locale);

  useEffect(() => {
    setLocale(getPreferredLocale(new URLSearchParams(window.location.search)));
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const initialEnabled = saved !== "off";
    setEnabled(initialEnabled);
    document.body.classList.toggle("high-contrast", initialEnabled);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("high-contrast", enabled);
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  }, [enabled]);

  return (
    <button
      type="button"
      onClick={() => setEnabled((v) => !v)}
      className="fixed right-4 z-[100] rounded-full border border-white/35 bg-black/70 px-3 py-2 text-[11px] tracking-[0.12em] text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
      aria-pressed={enabled}
      aria-label={t("common.toggle_high_contrast_mode")}
    >
      {enabled ? t("common.high_contrast_on") : t("common.high_contrast_off")}
    </button>
  );
}
