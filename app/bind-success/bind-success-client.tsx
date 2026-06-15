"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { APP_ENTRY_PATH } from "@/lib/site";
import { BIND_SUCCESS_EN } from "@/src/content/havenCopy";
import {
  markPairSharePromptDone,
  setPairSharingEnabled,
} from "@/src/services/pairSharingService";

type BindSuccessClientProps = {
  plusTrialActivated?: boolean;
  showPairPrompt?: boolean;
};

export function BindSuccessClient({
  plusTrialActivated,
  showPairPrompt = true,
}: BindSuccessClientProps) {
  const [pairChoice, setPairChoice] = useState<"pending" | "yes" | "no">(
    showPairPrompt ? "pending" : "yes"
  );
  const sealFirstHref = `${APP_ENTRY_PATH}?open=new&autoSeal=true`;

  useEffect(() => {
    if (!showPairPrompt) return;
    setPairSharingEnabled(true);
  }, [showPairPrompt]);

  function confirmPairShare(enabled: boolean) {
    setPairSharingEnabled(enabled);
    markPairSharePromptDone();
    setPairChoice(enabled ? "yes" : "no");
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.kicker}>{BIND_SUCCESS_EN.title}</p>
        <div style={styles.check} aria-hidden>
          ✓
        </div>
        <h1 style={styles.title}>{BIND_SUCCESS_EN.subtitle}</h1>
        {plusTrialActivated ? (
          <p style={styles.trial}>{BIND_SUCCESS_EN.plusTrialNote}</p>
        ) : null}
        {pairChoice === "pending" ? (
          <div style={styles.pairBlock}>
            <h2 style={styles.pairTitle}>{BIND_SUCCESS_EN.pairPromptTitle}</h2>
            <p style={styles.pairBody}>{BIND_SUCCESS_EN.pairPromptBody}</p>
            <div style={styles.pairActions}>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => confirmPairShare(true)}
              >
                {BIND_SUCCESS_EN.pairPromptYes}
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => confirmPairShare(false)}
              >
                {BIND_SUCCESS_EN.pairPromptNo}
              </button>
            </div>
          </div>
        ) : (
          <>
            {pairChoice === "yes" ? (
              <p style={styles.pairNote}>{BIND_SUCCESS_EN.pairActiveNote}</p>
            ) : null}
            <div style={styles.actions}>
              <Link href={sealFirstHref} style={styles.primaryButton}>
                {BIND_SUCCESS_EN.sealFirstMemoryCta}
              </Link>
              <Link href={APP_ENTRY_PATH} style={styles.secondaryButton}>
                {BIND_SUCCESS_EN.goToMemoriesCta}
              </Link>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#0a0a0a",
    color: "#f8efe7",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    textAlign: "center",
    padding: "36px 24px",
    borderRadius: 20,
    border: "1px solid rgba(212, 175, 55, 0.25)",
    background: "linear-gradient(180deg, #141210 0%, #0f0e0c 100%)",
  },
  kicker: {
    margin: "0 0 16px",
    fontSize: 12,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#d4af37",
  },
  check: {
    width: 56,
    height: 56,
    margin: "0 auto 20px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    color: "#0a0a0a",
    background: "#d4af37",
  },
  title: {
    margin: "0 0 12px",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 1.2,
  },
  trial: {
    margin: "0 0 20px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#b7f7c8",
  },
  pairBlock: {
    marginTop: 8,
    textAlign: "left",
  },
  pairTitle: {
    margin: "0 0 8px",
    fontSize: 18,
    fontWeight: 600,
    textAlign: "center",
  },
  pairBody: {
    margin: "0 0 16px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#e8dcd4",
    textAlign: "center",
  },
  pairNote: {
    margin: "0 0 20px",
    fontSize: 13,
    lineHeight: 1.45,
    color: "#c8b8a8",
  },
  pairActions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  primaryButton: {
    display: "block",
    padding: "16px 20px",
    borderRadius: 12,
    background: "#d4af37",
    color: "#0a0a0a",
    fontWeight: 600,
    fontSize: 17,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    width: "100%",
  },
  secondaryButton: {
    display: "block",
    padding: "14px 20px",
    borderRadius: 12,
    border: "1px solid #3d2f28",
    color: "#f8efe7",
    fontSize: 15,
    textDecoration: "none",
    background: "transparent",
    cursor: "pointer",
    width: "100%",
  },
};
