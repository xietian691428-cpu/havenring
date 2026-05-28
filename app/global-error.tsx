"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          background: "#0e0c0b",
          color: "#f8efe7",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: 24,
        }}
      >
        <main style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: 26 }}>Something went wrong</h1>
          <p style={{ margin: "0 0 16px", color: "#d9c3b3", lineHeight: 1.5 }}>
            We hit a rendering issue. Try a soft refresh first.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                borderRadius: 999,
                border: "1px solid #d9a67a",
                background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
                color: "#1b1411",
                padding: "12px 16px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Soft refresh
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "transparent",
                color: "#f8efe7",
                padding: "10px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try recover
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}

