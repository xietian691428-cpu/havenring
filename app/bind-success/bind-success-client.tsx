"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { APP_ENTRY_PATH } from "@/lib/site";
import { BIND_SUCCESS_EN } from "@/src/content/havenCopy";

type BindSuccessClientProps = {
  plusTrialActivated?: boolean;
};

export function BindSuccessClient({ plusTrialActivated }: BindSuccessClientProps) {
  const sealFirstHref = `${APP_ENTRY_PATH}?open=new&autoSeal=true`;

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
        <div style={styles.actions}>
          <Link href={sealFirstHref} style={styles.primaryButton}>
            {BIND_SUCCESS_EN.sealFirstMemoryCta}
          </Link>
          <Link href={APP_ENTRY_PATH} style={styles.secondaryButton}>
            {BIND_SUCCESS_EN.goToMemoriesCta}
          </Link>
        </div>
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
  subtitle: {
    margin: "0 0 28px",
    fontSize: 20,
    lineHeight: 1.45,
    color: "#e8dcd4",
  },
  trial: {
    margin: "0 0 20px",
    fontSize: 14,
    lineHeight: 1.5,
    color: "#b7f7c8",
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
  },
  secondaryButton: {
    display: "block",
    padding: "14px 20px",
    borderRadius: 12,
    border: "1px solid #3d2f28",
    color: "#f8efe7",
    fontSize: 15,
    textDecoration: "none",
  },
};
