/** First-name style label for partner invite UI (no email leakage). */
export function inviterDisplayNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string {
  const meta = metadata || {};
  const full = String(meta.full_name || meta.name || "").trim();
  if (full) {
    const first = full.split(/\s+/)[0];
    if (first) return first;
  }
  const email = String(meta.email || "").trim();
  if (email.includes("@")) {
    const local = email.split("@")[0]?.trim();
    if (local) return local;
  }
  return "your partner";
}
