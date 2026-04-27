import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMemory,
  deleteMemory,
  getAllMemories,
  getMemoryById,
} from "../services/localStorageService";

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
        const result = await createMemory(payload);
        const created = await getMemoryById(result.id);
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
