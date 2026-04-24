"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const controller = new AbortController();
    window.addEventListener(
      "load",
      () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/", updateViaCache: "none" })
          .catch(() => {
            // Installability is best-effort. The app must still function
            // without a service worker.
          });
      },
      { signal: controller.signal, once: true }
    );

    return () => controller.abort();
  }, []);

  return null;
}
