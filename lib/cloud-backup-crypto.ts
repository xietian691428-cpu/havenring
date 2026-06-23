/**
 * Client-side encryption for Plus cloud backups (opaque ciphertext at rest).
 * Account-scoped key — same Haven login can decrypt on another device.
 */

const CLOUD_BACKUP_PBKDF2_SALT = "haven-ring-cloud-backup-v1";
const CLOUD_BACKUP_PBKDF2_ITERATIONS = 120_000;

export type CloudBackupEnvelopeV1 = {
  v: 1;
  alg: "AES-GCM-account-v1";
  iv: string;
  data: string;
  backedUpAt: number;
};

export type CloudBackupPlaintext = {
  backedUpAt: number;
  kind: string;
  memoryId: string | null;
  payload: unknown;
};

function utf8Bytes(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value) as Uint8Array<ArrayBuffer>;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes as Uint8Array<ArrayBuffer>;
}

async function deriveAccountBackupKey(userId: string): Promise<CryptoKey> {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable.");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    utf8Bytes(String(userId || "").trim()),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: utf8Bytes(CLOUD_BACKUP_PBKDF2_SALT),
      iterations: CLOUD_BACKUP_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptCloudBackupPlaintext(
  plaintext: CloudBackupPlaintext,
  userId: string
): Promise<CloudBackupEnvelopeV1> {
  const key = await deriveAccountBackupKey(userId);
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>;
  const body = utf8Bytes(JSON.stringify(plaintext));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, body);
  return {
    v: 1,
    alg: "AES-GCM-account-v1",
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    backedUpAt: Number(plaintext.backedUpAt || Date.now()),
  };
}

export async function decryptCloudBackupEnvelope(
  envelope: CloudBackupEnvelopeV1,
  userId: string
): Promise<CloudBackupPlaintext> {
  if (!envelope || envelope.v !== 1 || envelope.alg !== "AES-GCM-account-v1") {
    throw new Error("Unsupported cloud backup envelope.");
  }
  const key = await deriveAccountBackupKey(userId);
  const iv = fromBase64(envelope.iv);
  const data = fromBase64(envelope.data);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  const parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(plainBuffer)));
  return parsed as CloudBackupPlaintext;
}
