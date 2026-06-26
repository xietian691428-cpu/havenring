import { getMemoryById, saveMemory } from "./localStorageService";

/** Main-thread IDB marks after server finalize succeeds (network may run in Worker). */
export async function markMemoriesServerSealedLocally(draftIds: string[]): Promise<void> {
  const serverSealedAt = Date.now();
  for (const id of draftIds) {
    const existing = await getMemoryById(id);
    if (!existing) continue;
    await saveMemory({ ...existing, serverSealedAt }, { allowCoreEdit: true });
  }
}
