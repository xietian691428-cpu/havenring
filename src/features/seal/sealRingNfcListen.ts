import { readNfcScanFull } from "../../services/nfcRingService";
import { isStaticStartRingUrl, normalizeRingTapToStartHref } from "./parseRingTapUrl";

export type SealRingListenResult =
  | { ok: true; target: string }
  | { ok: false; message: string; kind?: "static_start" | "other" };

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
    if (isStaticStartRingUrl(text, origin)) {
      return {
        ok: false,
        kind: "static_start",
        message:
          "We read your ring, but the security code only appears when Chrome opens the tap. Hold the ring on the back until the page refreshes or a new tab opens—do not use in-page NFC scan here.",
      };
    }
    return {
      ok: false,
      kind: "other",
      message:
        "Ring link is missing dynamic seal parameters. The ring must be programmed to havenring.me/start with SDM enabled—contact support if this keeps happening.",
    };
  }
  return { ok: true, target };
}
