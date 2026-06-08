"use client";

import type { CSSProperties } from "react";
import { ACTION_STEP_TIMING } from "@/lib/nfc-flow-timing";
import { useSlowStatusHint } from "../hooks/useSlowStatusHint";

type IndeterminateStepStatusProps = {
  active: boolean;
  label: string;
  slowLabel: string;
  slowAfterMs?: number;
  style?: CSSProperties;
};

/**
 * Non-numeric wait status for background/server steps (Western UX: no ticking countdown).
 */
export function IndeterminateStepStatus({
  active,
  label,
  slowLabel,
  slowAfterMs = ACTION_STEP_TIMING.slowStatusHintMs,
  style,
}: IndeterminateStepStatusProps) {
  const slow = useSlowStatusHint(active, slowAfterMs);
  if (!active) return null;

  return (
    <p style={style ?? defaultStyle} role="status" aria-live="polite">
      {slow ? slowLabel : label}
    </p>
  );
}

const defaultStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
  opacity: 0.72,
};
