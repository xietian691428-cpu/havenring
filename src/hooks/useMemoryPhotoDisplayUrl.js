import { useEffect, useState } from "react";
import { resolveMemoryPhotoUrl, isBlobRefPhoto } from "../../lib/memory-photo-display";
import { getMemoryPhotoBlob } from "../services/localStorageService";

/**
 * Resolve one memory photo for detail view — inline dataUrl or lazy blob from photoBlobs.
 */
export function useMemoryPhotoDisplayUrl(photoRow, variant = "full", memoryId = "") {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let active = true;

    const inline = resolveMemoryPhotoUrl(photoRow);
    if (inline) {
      setUrl(inline);
      return undefined;
    }

    if (!isBlobRefPhoto(photoRow)) {
      setUrl("");
      return undefined;
    }

    const photoId = String(photoRow.id || "");
    const scopedMemoryId = String(memoryId || "");
    if (!photoId || !scopedMemoryId) {
      setUrl("");
      return undefined;
    }

    setUrl("");
    void getMemoryPhotoBlob(scopedMemoryId, photoId, variant).then((blob) => {
      if (!active || !blob || typeof URL === "undefined") return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      active = false;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          /* ignore */
        }
      }
    };
  }, [photoRow, variant, memoryId]);

  return url;
}
