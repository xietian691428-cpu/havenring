import { useEffect, useRef, useState } from "react";
import { isIosWebKit } from "@/lib/composer-platform-limits";

/**
 * Track which timeline rows intersect the scroll root (iOS only).
 * Avoids decoding thumbs for the full loaded page at once.
 */
export function useTimelineViewportIds(memoryIds = [], enabled = true) {
  const [viewportIds, setViewportIds] = useState(() => new Set());
  const observerRef = useRef(null);
  const nodeByIdRef = useRef(new Map());

  useEffect(() => {
    if (!enabled || !isIosWebKit() || typeof window === "undefined") {
      setViewportIds(new Set(memoryIds));
      return undefined;
    }

    const root = document.querySelector(".haven-app-main-scroll");
    if (!root) {
      setViewportIds(new Set(memoryIds.slice(0, 4)));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setViewportIds((prev) => {
          const next = new Set(prev);
          for (const entry of entries) {
            const id = entry.target.getAttribute("data-memory-id") || "";
            if (!id) continue;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      { root, rootMargin: "80px 0px", threshold: 0.01 }
    );
    observerRef.current = observer;

    for (const id of memoryIds) {
      const node = nodeByIdRef.current.get(id);
      if (node) observer.observe(node);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [enabled, memoryIds]);

  const setRowRef = (memoryId) => (node) => {
    if (!memoryId) return;
    const prev = nodeByIdRef.current.get(memoryId);
    if (prev && observerRef.current) {
      observerRef.current.unobserve(prev);
    }
    if (node) {
      nodeByIdRef.current.set(memoryId, node);
      observerRef.current?.observe(node);
    } else {
      nodeByIdRef.current.delete(memoryId);
    }
  };

  return { viewportIds, setRowRef, viewportLimited: isIosWebKit() && enabled };
}
