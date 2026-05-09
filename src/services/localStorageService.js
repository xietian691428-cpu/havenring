/**
 * Legacy filename — memories live in IndexedDB via `localMemoryStore`.
 *
 * Prefer: `import { … } from "@/src/features/memories/localMemoryStore"` or this file.
 */
export {
  clearAllMemories,
  createMemory,
  deleteMemory,
  getAllMemories,
  getMemoryById,
  memoryRepository,
  saveMemory,
} from "./localMemoryStore";
