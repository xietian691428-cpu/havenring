import { useEffect, useRef, useState } from "react";
import { visibleSecondsRemaining } from "@/lib/nfc-flow-timing";

/**
 * Tracks a visible countdown synced to `startedAt + durationMs`.
 * Resets whenever `active` flips true.
 */
export function useActionStepCountdown(active, durationMs) {
  const startedAtRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) {
      startedAtRef.current = 0;
      return undefined;
    }
    startedAtRef.current = Date.now();
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [active, durationMs]);

  void tick;
  const startedAt = startedAtRef.current;
  if (!active || !startedAt) {
    return { endsAt: 0, remainingSec: 0, isActive: false };
  }
  const endsAt = startedAt + durationMs;
  return {
    endsAt,
    remainingSec: visibleSecondsRemaining(endsAt),
    isActive: true,
  };
}

/**
 * Live countdown for a fixed deadline (e.g. sync retry at nextRetryAt).
 */
export function useDeadlineCountdown(deadlineMs) {
  const active = Boolean(deadlineMs && deadlineMs > Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(id);
  }, [active, deadlineMs]);

  void tick;
  if (!active) {
    return { endsAt: 0, remainingSec: 0, isActive: false };
  }
  return {
    endsAt: deadlineMs,
    remainingSec: visibleSecondsRemaining(deadlineMs),
    isActive: true,
  };
}
