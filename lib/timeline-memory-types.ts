import type { LocalMemory, MemorySupplement } from "@/src/features/memories/localMemoryStore";

/** Timeline row — metadata + story preview; media decrypted on demand. */
export type TimelineMemorySummary = Omit<
  LocalMemory,
  "photo" | "voice" | "attachments"
> & {
  photo: null;
  voice: null;
  attachments: [];
  hasPhotos: boolean;
  storyPreview: string;
};

export type TimelineMemoryPage = {
  items: TimelineMemorySummary[];
  hasMore: boolean;
  nextBeforeTimelineAt: number | null;
};
