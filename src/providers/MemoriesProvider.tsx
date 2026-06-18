"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMemories } from "../hooks/useMemories";

type MemoriesContextValue = ReturnType<typeof useMemories>;

const MemoriesContext = createContext<MemoriesContextValue | null>(null);

type MemoriesProviderProps = {
  children: ReactNode;
  /** When true, timeline refresh + background sync effects are allowed to run. */
  timelineLifecycleActive: boolean;
};

export function MemoriesProvider({
  children,
  timelineLifecycleActive,
}: MemoriesProviderProps) {
  const value = useMemories({ timelineLifecycleActive });
  return (
    <MemoriesContext.Provider value={value}>{children}</MemoriesContext.Provider>
  );
}

export function useMemoriesContext(): MemoriesContextValue {
  const ctx = useContext(MemoriesContext);
  if (!ctx) {
    throw new Error("useMemoriesContext must be used within MemoriesProvider.");
  }
  return ctx;
}
