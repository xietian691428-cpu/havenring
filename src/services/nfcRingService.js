/**
 * Unified NFC read/write service for Haven Ring.
 *
 * Notes:
 * - Ring should hold one long-term fixed entry URL (e.g. /hub).
 * - Save-to-Haven remains local-only; NFC write is for initial setup/recovery only.
 */

const NFC_ERROR_LOG_KEY = "haven.nfc.error.log.v1";

function ensureNdefSupport() {
  if (typeof window === "undefined" || !("NDEFReader" in window)) {
    throw new Error("NFC not supported on this device.");
  }
}

function pushNfcErrorLog(error, context = "unknown") {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(NFC_ERROR_LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      context,
      message: String(error?.message || error || "Unknown NFC error"),
      ts: Date.now(),
    });
    // Keep latest 30 entries for diagnostics.
    window.localStorage.setItem(NFC_ERROR_LOG_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // Silent fallback.
  }
}

export function getRecentNfcErrors() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NFC_ERROR_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function readRingTextRecord() {
  try {
    ensureNdefSupport();
    const reader = new window.NDEFReader();
    await reader.scan();

    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Connection lost while reading NFC ring."));
      }, 10_000);

      reader.onreadingerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Tag connection lost during read."));
      };

      reader.onreading = (event) => {
        window.clearTimeout(timeout);
        try {
          const record = event.message.records?.[0];
          if (!record) {
            reject(new Error("Nothing found on ring."));
            return;
          }
          const decoder = new TextDecoder(record.encoding || "utf-8");
          const text = decoder.decode(record.data);
          resolve({ text });
        } catch (error) {
          reject(error);
        }
      };
    });
  } catch (error) {
    pushNfcErrorLog(error, "read");
    throw error;
  }
}

export async function writeFixedEntryUrlToRing(entryUrl) {
  try {
    ensureNdefSupport();
    if (!entryUrl || typeof entryUrl !== "string") {
      throw new Error("Invalid entry URL.");
    }

    const reader = new window.NDEFReader();
    await reader.write({
      records: [{ recordType: "url", data: entryUrl }],
    });
    return { ok: true, entryUrl };
  } catch (error) {
    pushNfcErrorLog(error, "write");
    throw error;
  }
}
