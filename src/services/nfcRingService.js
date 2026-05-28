/**
 * Unified NFC read/write service for Haven Ring.
 *
 * Notes:
 * - Ring should hold one long-term fixed entry URL (e.g. /hub).
 * - Save-to-Haven remains local-only; NFC write is for initial setup/recovery only.
 */

import {
  acquireNfcLock,
  forceClearNfcLock,
} from "./nfcLockService";
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
  const full = await readNfcScanFull();
  return { text: full.text };
}

/**
 * Reads first NDEF record plus optional tag serial (Android Chrome Web NFC).
 * @returns {{ text: string, serialNumber: string | null, recordType?: string }}
 */
export async function readNfcScanFull() {
  const lock = acquireNfcLock("nfcRingService.read", 15_000);

  const handleNfcReading = (event, resolve, reject, timeout) => {
    window.clearTimeout(timeout);
    try {
      event?.stopImmediatePropagation?.();
      const record = event.message.records?.[0];
      let text = "";
      let recordType = "";
      if (record) {
        recordType = record.recordType || "";
        const decoder = new TextDecoder(record.encoding || "utf-8");
        text = decoder.decode(record.data);
      }
      const serialNumber =
        typeof event.serialNumber === "string" && event.serialNumber.trim()
          ? event.serialNumber.trim()
          : null;
      if (!text && !serialNumber) {
        reject(new Error("Nothing found on ring."));
        return;
      }
      resolve({ text, serialNumber, recordType });
    } catch (error) {
      reject(error);
    }
  };

  try {
    ensureNdefSupport();
    if (!lock.ok) {
      console.log("NFC reader already active", lock.owner);
      return null;
    }

    const reader = new window.NDEFReader();
    await reader.scan();
    console.log("=== NFC SCAN STARTED SUCCESSFULLY ===");

    return await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Connection lost while reading NFC ring."));
      }, 12_000);

      reader.onreadingerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Tag connection lost during read."));
      };

      reader.onreading = (event) => {
        console.log("=== NFC ONREADING TRIGGERED ===", event);
        window.setTimeout(() => {
          handleNfcReading(event, resolve, reject, timeout);
        }, 60);
      };
    });
  } catch (error) {
    console.error("=== NFC SCAN FAILED ===", error);
    pushNfcErrorLog(error, "read");
    throw error;
  } finally {
    lock.release();
    // Force clear stale locks defensively.
    window.setTimeout(() => forceClearNfcLock(), 15_000);
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
