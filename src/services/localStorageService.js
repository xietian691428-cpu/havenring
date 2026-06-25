/**
 * Legacy filename — memories live in IndexedDB via `localMemoryStore`.
 *
 * Prefer: `import { … } from "@/src/features/memories/localMemoryStore"` or this file.
 */
export {
  appendMemorySupplement,
  clearAllMemories,
  createMemory,
  deleteMemory,
  getAllMemories,
  getMemoryCount,
  getMemoryById,
  getTimelineMemorySummaries,
  getTimelineMemoryThumbnail,
  getTimelineMemoryThumbBlob,
  getTimelineMemoryMediumBlob,
  getMemoryPhotoBlob,
  searchTimelineMemorySummaries,
  memoryRepository,
  saveMemory,
  readLocalStorageQuotaWarnFlag,
  warnIfLocalStorageTight,
} from "./localMemoryStore";
