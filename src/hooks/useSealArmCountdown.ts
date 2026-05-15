import { useEffect, useMemo, useState } from "react";
import { getSealArmedRemainingMs } from "../features/seal";

function formatSealCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Live countdown for the Seal-with-Ring arm window (sessionStorage via `lib/seal-flow`).
 */
export function useSealArmCountdown(active: boolean): {
  remainingMs: number;
  remainingLabel: string;
} {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  return useMemo(() => {
    void tick;
    const remainingMs = active ? getSealArmedRemainingMs() : 0;
    return {
      remainingMs,
      remainingLabel: formatSealCountdown(remainingMs),
    };
  }, [active, tick]);
}
