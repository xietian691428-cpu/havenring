/** Lightweight Pair model — max 2 haven members, sealed memories shared in haven. */

export const PAIR_MAX_MEMBERS = 2;

export type ServerMomentDraft = {
  id: string;
  title: string;
  story: string;
  photo: unknown[];
  attachments: unknown[];
  releaseAt: number;
};

/** Decode seal_finalize_atomic vault (base64 JSON draft). */
export function decodeServerMomentVault(encryptedVault: string): ServerMomentDraft | null {
  const raw = String(encryptedVault || "").trim();
  if (!raw) return null;
  try {
    const json = atob(raw);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const id = String(parsed.id || "").trim();
    if (!id) return null;
    return {
      id,
      title: String(parsed.title || "").trim(),
      story: String(parsed.story || ""),
      photo: Array.isArray(parsed.photo) ? parsed.photo : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
      releaseAt: Number(parsed.releaseAt || 0) || 0,
    };
  } catch {
    return null;
  }
}
