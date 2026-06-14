// AES-GCM 256 authenticated encryption via Web Crypto (PRD 8).

import type { AesGcmBlob } from "@/lib/types";
import { base64ToBytes, bytesToBase64 } from "@/lib/encoding";
import { randomBytes } from "./random";

const IV_BYTES = 12;
const KEY_BITS = 256;

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: KEY_BITS }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function aesEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
): Promise<AesGcmBlob> {
  const iv = randomBytes(IV_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    plaintext.buffer as ArrayBuffer,
  );
  return {
    alg: "AES-GCM",
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ct)),
  };
}

/**
 * Decrypts an AES-GCM blob. Throws if the auth tag fails (wrong key / tampered data);
 * callers map this to a WRONG_SECRET or VAULT_CORRUPT app error.
 */
export async function aesDecrypt(
  key: CryptoKey,
  blob: AesGcmBlob,
): Promise<Uint8Array> {
  const iv = base64ToBytes(blob.iv);
  const ct = base64ToBytes(blob.ct);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer,
  );
  return new Uint8Array(plaintext);
}
