import {
  openMemoryDb,
  STORE_MEMORY_SUPPLEMENTS,
  txDone,
} from "@/lib/memory-db";
import {
  mergeSupplements,
  type MemorySupplement,
} from "@/lib/memory-supplements";

type SupplementsRow = {
  memoryId: string;
  supplements: MemorySupplement[];
  updatedAt: number;
};

export async function readSupplementsForMemory(
  memoryId: string
): Promise<MemorySupplement[]> {
  if (!memoryId) return [];
  const db = await openMemoryDb();
  try {
    const row = await new Promise<SupplementsRow | null>((resolve, reject) => {
      const tx = db.transaction(STORE_MEMORY_SUPPLEMENTS, "readonly");
      const req = tx.objectStore(STORE_MEMORY_SUPPLEMENTS).get(memoryId);
      req.onsuccess = () => resolve((req.result ?? null) as SupplementsRow | null);
      req.onerror = () =>
        reject(req.error ?? new Error("Failed to read memory supplements."));
    });
    return Array.isArray(row?.supplements) ? row.supplements : [];
  } finally {
    db.close();
  }
}

export async function writeSupplementsForMemory(
  memoryId: string,
  supplements: MemorySupplement[]
): Promise<void> {
  if (!memoryId) return;
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_MEMORY_SUPPLEMENTS, "readwrite");
    tx.objectStore(STORE_MEMORY_SUPPLEMENTS).put({
      memoryId,
      supplements: mergeSupplements([], supplements),
      updatedAt: Date.now(),
    } satisfies SupplementsRow);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteSupplementsForMemory(memoryId: string): Promise<void> {
  if (!memoryId) return;
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_MEMORY_SUPPLEMENTS, "readwrite");
    tx.objectStore(STORE_MEMORY_SUPPLEMENTS).delete(memoryId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function clearAllMemorySupplements(): Promise<void> {
  const db = await openMemoryDb();
  try {
    const tx = db.transaction(STORE_MEMORY_SUPPLEMENTS, "readwrite");
    tx.objectStore(STORE_MEMORY_SUPPLEMENTS).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** metaEnc supplements + sidecar row → canonical list for reads. */
export async function resolveMemorySupplements(
  memoryId: string,
  fromMeta: MemorySupplement[] | null | undefined
): Promise<MemorySupplement[]> {
  const sidecar = await readSupplementsForMemory(memoryId);
  return mergeSupplements(fromMeta, sidecar);
}
