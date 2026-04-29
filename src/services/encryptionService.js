/**
 * Haven Ring - Local Encryption Service
 *
 * Privacy model:
 * - Content is encrypted before local persistence using AES-GCM.
 * - Default key is device-local (random); optionally wrapped with a user-derived
 *   key when device protection / passphrase flows are enabled (see Haven security profile).
 *
 * Checklist: all durable local blobs SHOULD use keys derived from the user's
 * passphrase via PBKDF2 before wrapping the AES data key — migrate incrementally.
 *
 * IMPORTANT:
 * "Your content is encrypted and stored locally on your device."
 */

const KEY_DB_NAME = "haven_ring_crypto_db";
const KEY_DB_VERSION = 1;
const KEY_STORE = "crypto_meta";
const KEY_RECORD_ID = "primary_aes_gcm_key";
const ALGO = "AES-GCM";
const KEY_USAGE = ["encrypt", "decrypt"];
const IV_LENGTH = 12; // Recommended for AES-GCM

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8Encode(value) {
  return new TextEncoder().encode(value);
}

function utf8Decode(bytes) {
  return new TextDecoder().decode(bytes);
}

function openKeyDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY_DB_NAME, KEY_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open key database."));
  });
}

function readStoredKey(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readonly");
    const store = tx.objectStore(KEY_STORE);
    const req = store.get(KEY_RECORD_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Failed to read key record."));
  });
}

function writeStoredKey(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readwrite");
    const store = tx.objectStore(KEY_STORE);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("Failed to store key record."));
  });
}

let keyPromise = null;

async function loadOrCreateKey() {
  const db = await openKeyDb();
  try {
    const existing = await readStoredKey(db);
    if (existing?.jwk) {
      return crypto.subtle.importKey("jwk", existing.jwk, { name: ALGO }, true, KEY_USAGE);
    }

    const key = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 },
      true, // extractable so we can persist JWK in IndexedDB
      KEY_USAGE
    );
    const jwk = await crypto.subtle.exportKey("jwk", key);
    await writeStoredKey(db, { id: KEY_RECORD_ID, jwk, createdAt: Date.now() });
    return key;
  } finally {
    db.close();
  }
}

async function getKey() {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable. Secure context (HTTPS) is required.");
  }
  if (!keyPromise) {
    keyPromise = loadOrCreateKey();
  }
  return keyPromise;
}

function toPlaintext(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * Encrypts any serializable value using device-local key.
 * Returns a compact payload safe for IndexedDB storage.
 */
export async function encryptValue(value) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = utf8Encode(toPlaintext(value));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    plaintext
  );

  return {
    alg: ALGO,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipherBuffer)),
    ts: Date.now(),
  };
}

/**
 * Decrypts payload created by encryptValue().
 * Returns UTF-8 string content.
 */
export async function decryptValue(payload) {
  if (!payload?.iv || !payload?.data) {
    throw new Error("Invalid encrypted payload.");
  }

  const key = await getKey();
  const iv = fromBase64(payload.iv);
  const data = fromBase64(payload.data);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGO, iv },
    key,
    data
  );

  return utf8Decode(new Uint8Array(plainBuffer));
}

/**
 * JSON-aware convenience wrapper.
 */
export async function encryptJson(value) {
  return encryptValue(JSON.stringify(value ?? null));
}

/**
 * JSON-aware convenience wrapper.
 */
export async function decryptJson(payload) {
  const text = await decryptValue(payload);
  return JSON.parse(text);
}

/**
 * Optional utility for rotating local key.
 * Caller must re-encrypt existing records if used in production flows.
 */
/**
 * Derives a wrapping key from a user passphrase (PBKDF2-SHA256) for encrypting
 * the local AES key material. Call when upgrading to user-bound local crypto.
 */
export async function deriveUserWrappingKey(passphrase, saltBytes) {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(passphrase)),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 210_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function rotateLocalKey() {
  const db = await openKeyDb();
  try {
    const key = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 },
      true,
      KEY_USAGE
    );
    const jwk = await crypto.subtle.exportKey("jwk", key);
    await writeStoredKey(db, { id: KEY_RECORD_ID, jwk, createdAt: Date.now() });
    keyPromise = Promise.resolve(key);
  } finally {
    db.close();
  }
}
