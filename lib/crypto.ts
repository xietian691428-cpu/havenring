// Haven Ring — local cryptography.
//
// Contract (do not weaken):
//   • The encryption key is generated in the browser via Web Crypto.
//   • It is stored ONLY in IndexedDB via idb-keyval.
//   • It is never serialized, never uploaded, never backed up, never synced.
//   • Losing the device == losing all moments on that device. That is the feature.
//
// AES-GCM 256 with a random 12-byte IV per message.

import { get, set, del } from "idb-keyval";

const KEY_STORAGE_KEY = "haven_identity_key";
const IV_BYTES = 12;

export interface EncryptedPayload {
  /** base64-encoded ciphertext + auth tag */
  encryptedVault: string;
  /** base64-encoded 12-byte IV */
  iv: string;
}

/* --------------------------------- helpers -------------------------------- */

function assertBrowser(): void {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error(
      "[haven-ring/crypto] Web Crypto is only available in the browser."
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/* ---------------------------------- key ---------------------------------- */

/**
 * Create a new AES-GCM 256 key and persist it to IndexedDB.
 * The key is created as `extractable: false` so it cannot be exported,
 * uploaded, or dumped. `idb-keyval` stores the CryptoKey handle directly.
 */
export async function generateAndStoreKey(): Promise<CryptoKey> {
  assertBrowser();
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  await set(KEY_STORAGE_KEY, key);
  return key;
}

/** Return the stored key, or `null` if this device has never generated one. */
export async function getStoredKey(): Promise<CryptoKey | null> {
  assertBrowser();
  const key = (await get(KEY_STORAGE_KEY)) as CryptoKey | undefined;
  return key ?? null;
}

/** Get the existing key, or lazily create one on first use. */
export async function getOrCreateKey(): Promise<CryptoKey> {
  const existing = await getStoredKey();
  if (existing) return existing;
  return generateAndStoreKey();
}

/**
 * Enforce a read-from-IndexedDB step before encryption.
 * If the key is missing, we create it once, then read it back from IndexedDB.
 */
async function getIndexedDbKeyForEncryption(): Promise<CryptoKey> {
  const existing = await getStoredKey();
  if (existing) return existing;
  await generateAndStoreKey();
  const stored = await getStoredKey();
  if (!stored) {
    throw new Error("[haven-ring/crypto] Failed to load key from IndexedDB.");
  }
  return stored;
}

/**
 * Permanently forget the local key. After this call, every moment created on
 * this device becomes mathematically unreadable.
 *
 * There is no recovery. That is the point.
 */
export async function destroyKey(): Promise<void> {
  await del(KEY_STORAGE_KEY);
}

/* ---------------------------- encrypt / decrypt --------------------------- */

/**
 * Encrypt plaintext (UTF-8) with the device's key. Returns base64 ciphertext
 * and base64 IV to be stored in Supabase as `encrypted_vault` and `iv`.
 */
export async function encrypt(plaintext: string): Promise<EncryptedPayload> {
  assertBrowser();
  const key = await getIndexedDbKeyForEncryption();
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(plaintext);

  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return {
    encryptedVault: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

/**
 * Decrypt a payload using the device's key. Will throw if the key has been
 * destroyed, the payload was encrypted on a different device, or the
 * ciphertext has been tampered with.
 *
 * This is only ever called from inside the vault — reached by physically
 * tapping the ring — and never from a free-standing UI affordance.
 */
export async function decrypt(payload: EncryptedPayload): Promise<string> {
  assertBrowser();
  const key = await getStoredKey();
  if (!key) {
    throw new Error(
      "[haven-ring/crypto] No key on this device. Cannot decrypt."
    );
  }
  const iv = base64ToBytes(payload.iv);
  const data = base64ToBytes(payload.encryptedVault);
  const plain = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return new TextDecoder().decode(plain);
}
