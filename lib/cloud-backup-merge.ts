import { mergeSupplements, type MemorySupplement } from "@/lib/memory-supplements";
import {
  getMemoryById,
  saveMemory,
  type LocalMemory,
} from "@/src/features/memories/localMemoryStore";

type CloudMemoryPayload = {
  id?: string;
  supplements?: MemorySupplement[];
  updatedAt?: number;
};

/**
 * Merge cloud memory into local — supplements append-only; local core content wins.
 */
export async function applyCloudMemoryToLocal(
  cloudPayload: CloudMemoryPayload | null | undefined
): Promise<{ merged: boolean; reason?: string }> {
  const memoryId = String(cloudPayload?.id || "").trim();
  if (!memoryId) return { merged: false, reason: "missing_id" };

  const existing = await getMemoryById(memoryId);
  if (!existing) return { merged: false, reason: "no_local_memory" };

  const cloudSupplements = Array.isArray(cloudPayload?.supplements)
    ? cloudPayload.supplements
    : [];
  const mergedSupplements = mergeSupplements(existing.supplements, cloudSupplements);
  const before = Array.isArray(existing.supplements) ? existing.supplements.length : 0;
  if (mergedSupplements.length <= before) {
    return { merged: false, reason: "no_new_supplements" };
  }

  await saveMemory({
    ...existing,
    supplements: mergedSupplements,
    updatedAt: Math.max(
      Number(existing.updatedAt || 0),
      Number(cloudPayload?.updatedAt || 0)
    ),
  });

  return { merged: true };
}

export function extractMemoryFromCloudPlaintext(
  plaintext: { payload?: unknown } | null | undefined
): CloudMemoryPayload | null {
  const payload = plaintext?.payload;
  if (!payload) return null;
  if (Array.isArray(payload)) return null;
  if (typeof payload !== "object") return null;
  const row = payload as CloudMemoryPayload & LocalMemory;
  if (!row.id) return null;
  return row;
}
