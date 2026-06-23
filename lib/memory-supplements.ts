/**
 * Post-seal notes (supplements) — merge helpers.
 * Append-only: never let null / undefined / empty array wipe existing notes.
 */

export type MemorySupplement = {
  id: string;
  text: string;
  createdAt: number;
  authorUserId?: string | null;
};

function isSupplementRow(value: unknown): value is MemorySupplement {
  if (!value || typeof value !== "object") return false;
  const row = value as MemorySupplement;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.text === "string" &&
    Number.isFinite(Number(row.createdAt))
  );
}

function normalizeList(rows: MemorySupplement[] | null | undefined): MemorySupplement[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isSupplementRow);
}

/**
 * Merge supplements defensively.
 * - incoming null / undefined / [] → return a copy of existing (no wipe).
 * - otherwise union by id; newer createdAt wins per id; sorted ascending by createdAt.
 */
export function mergeSupplements(
  existing: MemorySupplement[] | null | undefined,
  incoming: MemorySupplement[] | null | undefined
): MemorySupplement[] {
  const base = normalizeList(existing);
  const add = normalizeList(incoming);
  if (!add.length) return [...base];

  const byId = new Map<string, MemorySupplement>();
  for (const note of base) {
    byId.set(note.id, note);
  }
  for (const note of add) {
    const prev = byId.get(note.id);
    if (!prev || Number(note.createdAt) >= Number(prev.createdAt)) {
      byId.set(note.id, note);
    }
  }
  return [...byId.values()].sort(
    (a, b) => Number(a.createdAt) - Number(b.createdAt)
  );
}
