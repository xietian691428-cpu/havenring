"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { persistComposerMemoryPayload } from "../services/composerPersistService";

type ComposerDraftContextValue = {
  saving: boolean;
  error: string | null;
  persistComposerMemory: (
    payload: Record<string, unknown>
  ) => Promise<{ id: string }>;
};

const ComposerDraftContext = createContext<ComposerDraftContextValue | null>(null);

export function ComposerDraftProvider({ children }: { children: ReactNode }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistComposerMemory = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await persistComposerMemoryPayload(payload);
      return { id: result.id };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save memory.";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <ComposerDraftContext.Provider value={{ saving, error, persistComposerMemory }}>
      {children}
    </ComposerDraftContext.Provider>
  );
}

export function useComposerDraftContext(): ComposerDraftContextValue {
  const ctx = useContext(ComposerDraftContext);
  if (!ctx) {
    throw new Error("useComposerDraftContext must be used within ComposerDraftProvider.");
  }
  return ctx;
}

export function useOptionalComposerDraftContext(): ComposerDraftContextValue | null {
  return useContext(ComposerDraftContext);
}
