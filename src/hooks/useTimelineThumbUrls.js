import { useEffect, useRef, useState } from "react";
import {
  acquireTimelineThumbUrl,
  releaseAllTimelineThumbUrls,
  retainTimelineThumbUrls,
} from "@/lib/timeline-thumb-cache";
import { getTimelineMemoryThumbnail } from "../services/localStorageService";

/**
 * Hydrates low-res object URLs for visible timeline rows; revokes on scroll-away.
 */
export function useTimelineThumbUrls(visibleRows = []) {
  const [thumbById, setThumbById] = useState({});
  const visibleKey = visibleRows
    .map((row) => `${row?.id}:${row?.hasPhotos ? 1 : 0}`)
    .join("|");

  useEffect(() => {
    const visibleIds = new Set(
      visibleRows.filter((row) => row?.id && row?.hasPhotos !== false).map((row) => row.id)
    );
    retainTimelineThumbUrls(visibleIds);

    let cancelled = false;
    const loaders = [...visibleIds].map(async (memoryId) => {
      const row = visibleRows.find((item) => item?.id === memoryId);
      const url = await acquireTimelineThumbUrl(
        memoryId,
        () => getTimelineMemoryThumbnail(memoryId),
        { memoryUpdatedAt: Number(row?.updatedAt || 0) }
      );
      if (cancelled || !url) return;
      setThumbById((prev) => {
        if (!visibleIds.has(memoryId)) return prev;
        return { ...prev, [memoryId]: url };
      });
    });
    void Promise.all(loaders);

    return () => {
      cancelled = true;
    };
  }, [visibleKey, visibleRows]);

  useEffect(() => {
    return () => {
      releaseAllTimelineThumbUrls();
    };
  }, []);

  return thumbById;
}
