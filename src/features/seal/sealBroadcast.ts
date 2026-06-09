/**
 * Cross-tab seal signals via BroadcastChannel (normal browsing) with localStorage fallback.
 * Not used in ephemeral/private partitions where BC may be isolated per tab.
 */

import { STORAGE_KEYS } from "@/lib/storage-keys";
import { isEphemeralStorageEnvironment } from "./ephemeralStorage";

const CHANNEL_NAME = "haven.seal.broadcast.v1";

export type SealBroadcastMessage =
  | { type: "nfc_tap"; href: string; ts: number }
  | { type: "seal_complete"; ts: number };

type SealBroadcastHandler = (message: SealBroadcastMessage) => void;

let channel: BroadcastChannel | null = null;
const handlers = new Set<SealBroadcastHandler>();

function canUseBroadcastChannel(): boolean {
  if (typeof window === "undefined") return false;
  if (isEphemeralStorageEnvironment()) return false;
  return typeof BroadcastChannel !== "undefined";
}

function getChannel(): BroadcastChannel | null {
  if (!canUseBroadcastChannel()) return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event: MessageEvent<SealBroadcastMessage>) => {
        const data = event.data;
        if (!data || typeof data.type !== "string") return;
        for (const handler of handlers) {
          handler(data);
        }
      };
    } catch {
      channel = null;
    }
  }
  return channel;
}

export function postSealBroadcast(message: SealBroadcastMessage): void {
  const bc = getChannel();
  if (bc) {
    try {
      bc.postMessage(message);
    } catch {
      /* ignore */
    }
  }

  if (typeof window === "undefined") return;
  try {
    if (message.type === "seal_complete") {
      window.localStorage.setItem(
        STORAGE_KEYS.sealCompleteRelay,
        JSON.stringify({ ts: message.ts })
      );
    }
    if (message.type === "nfc_tap") {
      const payload = JSON.stringify({ href: message.href, ts: message.ts });
      window.sessionStorage.setItem(STORAGE_KEYS.sealNfcTapRelay, payload);
      window.localStorage.setItem(STORAGE_KEYS.sealNfcTapRelay, payload);
    }
  } catch {
    /* ignore */
  }
}

export function subscribeSealBroadcast(handler: SealBroadcastHandler): () => void {
  handlers.add(handler);
  getChannel();
  return () => {
    handlers.delete(handler);
  };
}

export function closeSealBroadcastChannel(): void {
  if (channel) {
    try {
      channel.close();
    } catch {
      /* ignore */
    }
    channel = null;
  }
}
