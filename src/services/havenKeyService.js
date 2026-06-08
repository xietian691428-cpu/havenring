import { get, set } from "idb-keyval";

export const PARTNER_INVITE_STORAGE_KEY = "haven.partner_invite_code.v1";
export const PARTNER_INVITE_KEY_PACKAGE_STORAGE_KEY = "haven.partner_invite_key_package.v1";
export const PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY = "haven.partner_invite_key_token.v1";

const MEMBER_KEYPAIR_ID = "haven.member_rsa_oaep_keypair.v1";
const HAVEN_KEY_PREFIX = "haven.shared_aes_key.v1:";
const DEFAULT_HAVEN_KEY_ID = "haven.default_haven_id.v1";
const TEXT = new TextEncoder();

function toBase64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const padded = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(withPad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function requireCrypto() {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
}

async function importAesJwk(jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

async function importRsaPublic(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

async function importRsaPrivate(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function ensureMemberKeyPair() {
  requireCrypto();
  const existing = await get(MEMBER_KEYPAIR_ID);
  if (existing?.publicJwk && existing?.privateJwk) {
    return {
      publicJwk: existing.publicJwk,
      privateKey: await importRsaPrivate(existing.privateJwk),
      publicKey: await importRsaPublic(existing.publicJwk),
    };
  }

  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  await set(MEMBER_KEYPAIR_ID, { publicJwk, privateJwk, createdAt: Date.now() });
  return { publicJwk, privateKey: pair.privateKey, publicKey: pair.publicKey };
}

export async function ensureHavenKey(havenId) {
  requireCrypto();
  const id = String(havenId || "").trim();
  if (!id) throw new Error("missing_haven_id");
  const storageKey = `${HAVEN_KEY_PREFIX}${id}`;
  const existing = await get(storageKey);
  if (existing?.jwk) {
    await set(DEFAULT_HAVEN_KEY_ID, id);
    return importAesJwk(existing.jwk);
  }
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await set(storageKey, { jwk, createdAt: Date.now() });
  await set(DEFAULT_HAVEN_KEY_ID, id);
  return key;
}

async function storeHavenKey(havenId, key) {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await set(`${HAVEN_KEY_PREFIX}${havenId}`, { jwk, createdAt: Date.now() });
  await set(DEFAULT_HAVEN_KEY_ID, havenId);
}

export async function getDefaultHavenCryptoKey() {
  requireCrypto();
  const havenId = await get(DEFAULT_HAVEN_KEY_ID);
  if (!havenId) return null;
  const existing = await get(`${HAVEN_KEY_PREFIX}${havenId}`);
  if (!existing?.jwk) return null;
  return {
    havenId,
    key: await importAesJwk(existing.jwk),
  };
}

async function deriveInviteWrapKey(inviteCode, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    TEXT.encode(String(inviteCode || "")),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 210_000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function createInviteKeyPackage(havenId, inviteCode) {
  const havenKey = await ensureHavenKey(havenId);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", havenKey));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveInviteWrapKey(inviteCode, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, raw));
  return {
    v: 1,
    alg: "PBKDF2-SHA256+A256GCM",
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    data: toBase64Url(cipher),
  };
}

export function encodeInviteKeyPackage(pkg) {
  return toBase64Url(TEXT.encode(JSON.stringify(pkg)));
}

export function decodeInviteKeyPackage(encoded) {
  const text = new TextDecoder().decode(fromBase64Url(encoded));
  return JSON.parse(text);
}

export function savePendingPartnerInvite(inviteCode, encodedPackage, keyToken = "") {
  if (typeof window === "undefined") return;
  if (inviteCode) window.localStorage.setItem(PARTNER_INVITE_STORAGE_KEY, inviteCode);
  if (encodedPackage) {
    window.localStorage.setItem(PARTNER_INVITE_KEY_PACKAGE_STORAGE_KEY, encodedPackage);
  }
  const kt = String(keyToken || "").trim();
  if (kt) {
    window.localStorage.setItem(PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY, kt);
  }
}

export function readPendingInviteKeyToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY) || "";
}

export function readInviteKeyPackageFromLocation() {
  if (typeof window === "undefined") return "";
  const hash = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
  return hash.get("key") || "";
}

export function readPendingInviteKeyPackage() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PARTNER_INVITE_KEY_PACKAGE_STORAGE_KEY) || "";
}

export function clearPendingPartnerInvite() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PARTNER_INVITE_STORAGE_KEY);
  window.localStorage.removeItem(PARTNER_INVITE_KEY_PACKAGE_STORAGE_KEY);
  window.localStorage.removeItem(PARTNER_INVITE_KEY_TOKEN_STORAGE_KEY);
}

export async function importHavenKeyFromInvitePackage(havenId, inviteCode, encodedPackage) {
  const pkg = decodeInviteKeyPackage(encodedPackage);
  if (pkg?.v !== 1 || !pkg.salt || !pkg.iv || !pkg.data) {
    throw new Error("invalid_invite_key_package");
  }
  const wrapKey = await deriveInviteWrapKey(inviteCode, fromBase64Url(pkg.salt));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(pkg.iv) },
    wrapKey,
    fromBase64Url(pkg.data)
  );
  const havenKey = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
  await storeHavenKey(havenId, havenKey);
  return havenKey;
}

export async function uploadWrappedHavenKey({ accessToken, havenId }) {
  if (!accessToken || !havenId) return { ok: false };
  const { publicJwk, publicKey } = await ensureMemberKeyPair();
  const havenKey = await ensureHavenKey(havenId);
  const raw = await crypto.subtle.exportKey("raw", havenKey);
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, raw));
  const res = await fetch("/api/haven/member-key", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      haven_id: havenId,
      public_key_jwk: publicJwk,
      wrapped_haven_key: {
        v: 1,
        alg: "RSA-OAEP-256+A256GCM",
        data: toBase64Url(wrapped),
      },
    }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || "haven_key_upload_failed");
  }
  return { ok: true };
}
