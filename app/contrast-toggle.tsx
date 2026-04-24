"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "haven.high_contrast";

export function ContrastToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
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
      className="fixed right-4 top-4 z-[100] rounded-full border border-white/35 bg-black/70 px-3 py-2 text-[11px] tracking-[0.12em] text-white/90 backdrop-blur-sm transition-colors hover:bg-black/90"
      aria-pressed={enabled}
      aria-label="Toggle high contrast mode"
    >
      {enabled ? "HIGH CONTRAST: ON" : "HIGH CONTRAST: OFF"}
    </button>
  );
}
