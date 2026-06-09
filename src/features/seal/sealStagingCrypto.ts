/**
 * Session-derived AES-GCM for ephemeral seal staging (server stores ciphertext only).
 */

import {
  SEAL_STAGING_HKDF_INFO,
  SEAL_STAGING_HKDF_SALT,
} from "@/lib/seal-staging-shared";

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function deriveSealStagingAesKey(
  accessToken: string
): Promise<CryptoKey> {
  if (!accessToken.trim()) {
    throw new Error("Sign in required.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    utf8(accessToken),
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8(SEAL_STAGING_HKDF_SALT),
      info: utf8(SEAL_STAGING_HKDF_INFO),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSealStagingJson(
  plaintextJson: string,
  accessToken: string
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveSealStagingAesKey(accessToken);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    utf8(plaintextJson) as BufferSource
  );
  return {
    ciphertext: toBase64(new Uint8Array(encrypted)),
    iv: toBase64(iv),
  };
}

export async function decryptSealStagingJson(
  ciphertext: string,
  iv: string,
  accessToken: string
): Promise<string> {
  const key = await deriveSealStagingAesKey(accessToken);
  const ivBytes = fromBase64(iv);
  const cipherBytes = fromBase64(ciphertext);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes as BufferSource },
    key,
    cipherBytes as BufferSource
  );
  return new TextDecoder().decode(decrypted);
}
