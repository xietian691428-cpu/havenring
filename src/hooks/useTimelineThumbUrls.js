import { useEffect, useRef, useState } from "react";
import { isIosWebKit } from "@/lib/composer-platform-limits";
import { isPostSealQuietWindow } from "@/lib/post-seal-memory-guard";
import {
  acquireTimelineThumbUrl,
  releaseAllTimelineThumbUrls,
  releaseTimelineThumbUrl,
  retainTimelineThumbUrls,
} from "@/lib/timeline-thumb-cache";
import { getTimelineMemoryThumbBlob } from "../services/localStorageService";

const IOS_THUMB_GAP_MS = 400;

function parseVisibleKey(visibleKey = "") {
  return visibleKey
    .split("|")
    .filter(Boolean)
    .map((part) => {
      const bits = part.split(":");
      if (bits.length >= 4) {
        const [id, hasPhotos, hasLarge, updatedAt] = bits;
        return {
          id,
          hasPhotos: hasPhotos !== "0",
          hasLargePhotos: hasLarge === "1",
          updatedAt: Number(updatedAt || 0),
        };
      }
      const [id, hasPhotos, updatedAt] = bits;
      return {
        id,
        hasPhotos: hasPhotos !== "0",
        hasLargePhotos: false,
        updatedAt: Number(updatedAt || 0),
      };
    });
}

function pruneThumbState(prev, keepIds) {
  const next = {};
  let changed = false;
  for (const [id, url] of Object.entries(prev)) {
    if (keepIds.has(id)) {
      next[id] = url;
    } else {
      changed = true;
    }
  }
  return changed ? next : prev;
}

/**
 * Hydrates low-res object URLs for visible virtual rows only.
 * Pauses during sync/refresh or text-first memory mode.
 */
export function useTimelineThumbUrls(visibleKey = "", paused = false, textFirst = false) {
  const [thumbById, setThumbById] = useState({});
  const visibleKeyRef = useRef(visibleKey);
  const prevVisibleIdsRef = useRef(new Set());

  useEffect(() => {
    visibleKeyRef.current = visibleKey;
  }, [visibleKey]);

  useEffect(() => {
    const blocked = textFirst || paused;
    if (blocked) {
      releaseAllTimelineThumbUrls();
      setThumbById({});
      prevVisibleIdsRef.current = new Set();
      return undefined;
    }

    const rows = parseVisibleKey(visibleKey);
    const visibleIds = new Set(
      rows.filter((row) => row.id && row.hasPhotos).map((row) => row.id)
    );

    for (const id of prevVisibleIdsRef.current) {
      if (!visibleIds.has(id)) {
        releaseTimelineThumbUrl(id);
      }
    }
    prevVisibleIdsRef.current = visibleIds;

    retainTimelineThumbUrls(visibleIds);
    setThumbById((prev) => pruneThumbState(prev, visibleIds));

    let cancelled = false;
    void (async () => {
      for (const row of rows) {
        if (cancelled || !row.id || !row.hasPhotos) continue;
        if (isPostSealQuietWindow()) continue;
        if (!visibleIds.has(row.id)) continue;

        const url = await acquireTimelineThumbUrl(
          row.id,
          () => getTimelineMemoryThumbBlob(row.id),
          { memoryUpdatedAt: row.updatedAt }
        );
        if (cancelled || !url) continue;
        if (visibleKeyRef.current !== visibleKey) continue;
        if (!visibleIds.has(row.id)) {
          releaseTimelineThumbUrl(row.id);
          continue;
        }
        setThumbById((prev) => {
          if (!visibleIds.has(row.id)) return prev;
          if (prev[row.id] === url) return prev;
          return { ...prev, [row.id]: url };
        });
        if (isIosWebKit()) {
          await new Promise((resolve) => window.setTimeout(resolve, IOS_THUMB_GAP_MS));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleKey, paused, textFirst]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        releaseAllTimelineThumbUrls();
        setThumbById({});
        prevVisibleIdsRef.current = new Set();
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
