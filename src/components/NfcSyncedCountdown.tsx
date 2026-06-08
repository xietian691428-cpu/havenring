"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { visibleSecondsRemaining } from "@/lib/nfc-flow-timing";

type NfcSyncedCountdownProps = {
  /** e.g. "Keep holding", "Tap again in", "Opening Haven in" */
  label: string;
  /** Unix ms when the timed phase ends. */
  endsAt: number;
  /** Optional suffix after the number, e.g. "s" is added automatically. */
  unit?: string;
};

/**
 * On-page countdown kept in sync with the same deadline used by flow timers.
 */
export function NfcSyncedCountdown({
  label,
  endsAt,
  unit = "s",
}: NfcSyncedCountdownProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [endsAt]);

  void tick;
  const remaining = visibleSecondsRemaining(endsAt);
  if (remaining <= 0) return null;

  return (
    <p style={styles.wrap} role="timer" aria-live="polite" aria-atomic="true">
      <span style={styles.label}>{label}</span>
      <strong style={styles.value}>
        {remaining}
        {unit}
      </strong>
    </p>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    margin: 0,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
    fontSize: 15,
    lineHeight: 1.4,
    color: "rgba(255,247,239,0.82)",
  },
  label: {
    letterSpacing: "0.01em",
  },
  value: {
    fontSize: 22,
    fontWeight: 700,
    color: "#f0c29e",
    fontVariantNumeric: "tabular-nums",
    minWidth: 36,
    textAlign: "center",
  },
};

/** Generic alias for non-NFC action steps (bind, claim, sync, etc.). */
export const ActionStepCountdown = NfcSyncedCountdown;
