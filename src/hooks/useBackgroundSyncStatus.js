import { useCallback, useEffect, useState } from "react";
import { readOfflineSyncQueue } from "../services/offlineSyncQueue";

/**
 * Pending background seal finalize / backup queue (Settings status line).
 */
export function useBackgroundSyncStatus() {
  const [pendingSealFinalize, setPendingSealFinalize] = useState(0);
  const [networkOnline, setNetworkOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );

  const refresh = useCallback(async () => {
    try {
      const queue = await readOfflineSyncQueue();
      const count = queue.filter((row) => row.kind === "seal_finalize").length;
      setPendingSealFinalize(count);
    } catch {
      setPendingSealFinalize(0);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    void refresh();
    const onConnectivity = () => {
      setNetworkOnline(navigator.onLine);
      void refresh();
    };
    window.addEventListener("online", onConnectivity);
    window.addEventListener("offline", onConnectivity);
    const timer = window.setInterval(() => {
      void refresh();
    }, 10_000);
    return () => {
      window.removeEventListener("online", onConnectivity);
      window.removeEventListener("offline", onConnectivity);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return {
    pendingSealFinalize,
    networkOnline,
    refresh,
  };
}
