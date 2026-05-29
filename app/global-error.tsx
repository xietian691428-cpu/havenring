"use client";

import { useEffect } from "react";
import { clearSealFlowAndReturnToApp } from "@/src/features/seal/sealFinalizeSafe";

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

  const digest = error?.digest ? ` (${error.digest})` : "";
  const detail =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "";

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
            Seal step hit a rendering issue. Your draft text is still saved on this device.
          </p>
          {detail ? (
            <p style={{ margin: "0 0 12px", color: "#ffb4a8", fontSize: 14 }}>{detail}</p>
          ) : null}
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
              onClick={() => {
                clearSealFlowAndReturnToApp();
              }}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.18)",
                background: "transparent",
                color: "#f8efe7",
                padding: "10px 16px",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Back to memories
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255, 255, 255, 0.18)",
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
          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#8f7a72" }}>
            Error digest{digest}
          </p>
        </main>
      </body>
    </html>
  );
}
