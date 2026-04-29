/**
 * Client-side integrity digest for sealed memory payloads (before E2EE wire format).
 * Store/compare `content_sha256` on sync (see `moments.content_sha256`).
 */

function toHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * @param {Record<string, unknown>} canonical - stable key order for hashing
 */
export async function sha256HexCanonicalObject(canonical) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto required for integrity hash.");
  }
  const json = JSON.stringify(
    Object.keys(canonical)
      .sort()
      .reduce((acc, k) => {
        acc[k] = canonical[k];
        return acc;
      }, {})
  );
  const data = new TextEncoder().encode(json);
  const buf = await window.crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(buf));
}

/**
 * @param {{ title?: string, story?: string, timelineAt?: number, photos?: unknown[] }} memory
 */
export async function computeMemoryBundleHash(memory) {
  const { title = "", story = "", timelineAt = 0, photos = [] } = memory || {};
  return sha256HexCanonicalObject({
    title: String(title),
    story: String(story),
    timelineAt: Number(timelineAt) || 0,
    photosCount: Array.isArray(photos) ? photos.length : 0,
  });
}
