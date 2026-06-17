"use client";

import { useEffect, useState } from "react";
import { consumeComposerMemoryStressFlag } from "@/lib/composer-memory-guard";

const COPY = {
  message: "App is running low on memory. Restarting…",
  reload: "Reload",
};

type ComposerMemoryRecoveryProps = {
  open?: boolean;
};

export function ComposerMemoryRecovery({ open = false }: ComposerMemoryRecoveryProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consumeComposerMemoryStressFlag()) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (open) setVisible(true);
  }, [open]);

  if (!visible) return null;

  function handleReload() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="haven-composer-memory-title"
      aria-describedby="haven-composer-memory-body"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "rgba(8, 6, 5, 0.72)",
      }}
    >
      <div
        style={{
          width: "min(100%, 360px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "#15110f",
          color: "#f8efe7",
          padding: "22px 20px",
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
        }}
      >
        <p
          id="haven-composer-memory-title"
          style={{ margin: "0 0 16px", fontSize: 17, lineHeight: 1.45, fontWeight: 600 }}
        >
          {COPY.message}
        </p>
        <p id="haven-composer-memory-body" style={{ margin: 0, display: "none" }}>
          {COPY.message}
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={handleReload}
            style={{
              borderRadius: 999,
              border: "1px solid #d9a67a",
              background: "linear-gradient(180deg, #e6b48d, #d9a67a)",
              color: "#1b1411",
              padding: "12px 16px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {COPY.reload}
          </button>
        </div>
      </div>
    </div>
  );
}
