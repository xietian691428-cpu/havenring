import { useEffect, useRef, useState } from "react";
import {
  acquireTimelineThumbUrl,
  releaseAllTimelineThumbUrls,
  retainTimelineThumbUrls,
} from "@/lib/timeline-thumb-cache";
import { getTimelineMemoryThumbBlob } from "../services/localStorageService";

function parseVisibleKey(visibleKey = "") {
  return visibleKey
    .split("|")
    .filter(Boolean)
    .map((part) => {
      const [id, hasPhotos, updatedAt] = part.split(":");
      return {
        id,
        hasPhotos: hasPhotos !== "0",
        updatedAt: Number(updatedAt || 0),
      };
    });
}

/**
 * Hydrates low-res object URLs for visible timeline rows; revokes on scroll-away.
 * Pauses during sync/refresh to avoid iOS WebKit OOM spikes.
 */
export function useTimelineThumbUrls(visibleKey = "", paused = false) {
  const [thumbById, setThumbById] = useState({});
  const visibleKeyRef = useRef(visibleKey);

  useEffect(() => {
    visibleKeyRef.current = visibleKey;
  }, [visibleKey]);

  useEffect(() => {
    if (paused) {
      releaseAllTimelineThumbUrls();
      setThumbById({});
      return undefined;
    }

    const rows = parseVisibleKey(visibleKey);
    const visibleIds = new Set(
      rows.filter((row) => row.id && row.hasPhotos).map((row) => row.id)
    );
    retainTimelineThumbUrls(visibleIds);

    let cancelled = false;
    void (async () => {
      for (const row of rows) {
        if (cancelled || !row.id || !row.hasPhotos) continue;
        if (!visibleIds.has(row.id)) continue;
        const url = await acquireTimelineThumbUrl(
          row.id,
          () => getTimelineMemoryThumbBlob(row.id),
          { memoryUpdatedAt: row.updatedAt }
        );
        if (cancelled || !url) continue;
        if (visibleKeyRef.current !== visibleKey) continue;
        setThumbById((prev) => {
          if (!visibleIds.has(row.id)) return prev;
          if (prev[row.id] === url) return prev;
          return { ...prev, [row.id]: url };
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleKey, paused]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseAllTimelineThumbUrls();
        setThumbById({});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    return () => {
      releaseAllTimelineThumbUrls();
    };
  }, []);

  return thumbById;
}
