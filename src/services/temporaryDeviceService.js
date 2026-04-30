import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearAllMemories } from "./localStorageService";
import { signOutCloudBackup } from "./cloudBackupService";

const TEMP_DEVICE_MODE_KEY = "haven.session.temporaryDevice.v1";
export const TEMP_DEVICE_MODE_EVENT = "haven:temporary-device-mode-changed";
const KNOWN_DB_NAMES = [
  "haven_ring_memories_db",
  "haven-ring-scoped-cache-v1",
  "haven_ring_crypto_db",
];

export function isTemporaryDeviceModeEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TEMP_DEVICE_MODE_KEY) === "1";
}

export function setTemporaryDeviceModeEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMP_DEVICE_MODE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(TEMP_DEVICE_MODE_EVENT, { detail: { enabled: Boolean(enabled) } })
  );
}

function clearStorageByPrefix(storage, prefixes = []) {
  const keys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }
  for (const key of keys) {
    storage.removeItem(key);
  }
}

async function deleteIndexedDb(name) {
  if (typeof indexedDB === "undefined") return;
  await new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
      req.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function clearBrowserCachesAndWorkers() {
  if (typeof window === "undefined") return;
  if (typeof caches !== "undefined" && typeof caches.keys === "function") {
    const names = await caches.keys().catch(() => []);
    await Promise.all(names.map((name) => caches.delete(name).catch(() => false)));
  }
  if (navigator.serviceWorker?.getRegistrations) {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)));
  }
}

export async function wipeTemporaryDevice({ keepMode = false } = {}) {
  if (typeof window === "undefined") return;
  const supabase = getSupabaseBrowserClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  await signOutCloudBackup().catch(() => null);
  await clearAllMemories().catch(() => null);
  await Promise.all(KNOWN_DB_NAMES.map((name) => deleteIndexedDb(name)));
  await clearBrowserCachesAndWorkers().catch(() => null);

  clearStorageByPrefix(window.localStorage, ["haven.", "sb-", "supabase."]);
  clearStorageByPrefix(window.sessionStorage, ["haven.", "sb-", "supabase."]);
  if (keepMode) {
    window.localStorage.setItem(TEMP_DEVICE_MODE_KEY, "1");
  } else {
    window.localStorage.removeItem(TEMP_DEVICE_MODE_KEY);
  }
  window.dispatchEvent(
    new CustomEvent(TEMP_DEVICE_MODE_EVENT, { detail: { enabled: Boolean(keepMode) } })
  );
}
