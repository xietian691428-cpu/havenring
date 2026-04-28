import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMemory,
  deleteMemory,
  getAllMemories,
  getMemoryById,
} from "../services/localStorageService";

const SAVE_RETRY_LIMIT = 2;

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function useMemories() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getAllMemories();
      setMemories(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load memories.");
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(
    async (payload) => {
      setSaving(true);
      setError(null);
      try {
        let result = null;
        let created = null;
        let lastError = null;

        for (let attempt = 0; attempt < SAVE_RETRY_LIMIT; attempt += 1) {
          try {
            result = await createMemory(payload);
            created = await getMemoryById(result.id);
            if (!created) {
              throw new Error("Saved memory could not be verified.");
            }
            break;
          } catch (err) {
            lastError = err;
            if (attempt < SAVE_RETRY_LIMIT - 1) {
              await delay(150 * (attempt + 1));
            }
          }
        }

        if (!result || !created) {
          throw (lastError instanceof Error
            ? lastError
            : new Error("Failed to create memory."));
        }

        if (created) {
          setMemories((prev) =>
            [created, ...prev].sort((a, b) => b.timelineAt - a.timelineAt)
          );
        }
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create memory.";
        setError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const remove = useCallback(async (id) => {
    setError(null);
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete memory.";
      setError(message);
      throw new Error(message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({
      memories,
      loading,
      saving,
      error,
      refresh,
      createMemory: create,
      deleteMemory: remove,
    }),
    [memories, loading, saving, error, refresh, create, remove]
  );
}
