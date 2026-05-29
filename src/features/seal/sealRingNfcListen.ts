import { readNfcScanFull } from "../../services/nfcRingService";
import { normalizeRingTapToStartHref } from "./parseRingTapUrl";

export type SealRingListenResult =
  | { ok: true; target: string }
  | { ok: false; message: string };

export async function listenForSealRingTapOnce(
  origin: string
): Promise<SealRingListenResult> {
  const scan = await readNfcScanFull();
  if (!scan) {
    return { ok: false, message: "NFC is busy. Wait a moment and try again." };
  }
  const text = String(scan.text || "").trim();
  if (!text) {
    return { ok: false, message: "Could not read a URL from the ring." };
  }
  if (/\/hub(\?|$)/i.test(text)) {
    return {
      ok: false,
      message: "Ring still points to /hub. Program it to open /start in Haven Settings.",
    };
  }
  const target = normalizeRingTapToStartHref(text, origin);
  if (!target) {
    return {
      ok: false,
      message:
        "Ring link is missing dynamic seal parameters. Factory URL should be /start with SDM enabled.",
    };
  }
  return { ok: true, target };
}
