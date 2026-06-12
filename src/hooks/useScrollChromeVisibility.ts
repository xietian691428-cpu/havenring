import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const SCROLL_DOWN_THRESHOLD = 8;
const SCROLL_UP_THRESHOLD = 6;
const TOP_REVEAL_THRESHOLD = 16;

/**
 * Western mobile pattern: hide top/bottom chrome on scroll down, reveal on scroll up.
 */
export function useScrollChromeVisibility(
  scrollRef: RefObject<HTMLElement | null>,
  resetKey = ""
) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const lastYRef = useRef(0);
  const tickingRef = useRef(false);

  const resetChrome = useCallback(() => {
    lastYRef.current = 0;
    setChromeVisible(true);
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [scrollRef]);

  useEffect(() => {
    resetChrome();
  }, [resetKey, resetChrome]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        tickingRef.current = false;
        const y = el.scrollTop;
        const delta = y - lastYRef.current;

        if (y <= TOP_REVEAL_THRESHOLD) {
          setChromeVisible(true);
        } else if (delta > SCROLL_DOWN_THRESHOLD) {
          setChromeVisible(false);
        } else if (delta < -SCROLL_UP_THRESHOLD) {
          setChromeVisible(true);
        }

        lastYRef.current = y;
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef, resetKey]);

  return { chromeVisible, resetChrome };
}
