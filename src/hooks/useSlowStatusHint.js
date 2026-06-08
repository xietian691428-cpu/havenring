import { useEffect, useState } from "react";

/**
 * Flips to true after `slowAfterMs` while `active` — for "Still …" copy without a numeric countdown.
 */
export function useSlowStatusHint(active, slowAfterMs) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return undefined;
    }
    setSlow(false);
    const id = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => window.clearTimeout(id);
  }, [active, slowAfterMs]);

  return slow;
}
