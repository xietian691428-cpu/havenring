import { useMemo } from "react";

const SUPPORTED = ["en", "fr", "es", "de", "it"];
const KEY = "haven.pwa.locale.v1";

export function resolvePwaLocale() {
  if (typeof window === "undefined") return "en";

  const fromQuery = new URLSearchParams(window.location.search).get("lang");
  if (fromQuery && SUPPORTED.includes(fromQuery.toLowerCase())) {
    const normalized = fromQuery.toLowerCase();
    window.localStorage.setItem(KEY, normalized);
    return normalized;
  }

  const saved = window.localStorage.getItem(KEY);
  if (saved && SUPPORTED.includes(saved.toLowerCase())) return saved.toLowerCase();

  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of langs) {
    const base = lang.toLowerCase().split("-")[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return "en";
}

export function usePwaLocale() {
  return useMemo(() => resolvePwaLocale(), []);
}
