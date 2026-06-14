// Key-derivation: Argon2id (production, via hash-wasm) with a PBKDF2-SHA-256
// fallback for environments where WASM Argon2id is unavailable (PRD 8 allows
// PBKDF2 temporarily). The chosen params are persisted in the vault metadata so
// the same KEK can be re-derived on unlock.

import { argon2id } from "hash-wasm";
import type { KdfParams } from "@/lib/types";
import { base64ToBytes, bytesToBase64, utf8ToBytes } from "@/lib/encoding";
import { importAesKey } from "./aesgcm";
import { randomBytes } from "./random";

const SALT_BYTES = 16;
const KEY_BYTES = 32;

// Argon2id defaults tuned for browser unlock targets (PRD 15). Adjust per device benchmarking.
export const ARGON2_DEFAULTS = {
  memKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 1,
} as const;

// PBKDF2 fallback cost. High iteration count to partially compensate for the weaker KDF.
export const PBKDF2_ITERATIONS = 310_000;

export function newSalt(): string {
  return bytesToBase64(randomBytes(SALT_BYTES));
}

export function defaultKdfParams(alg: KdfParams["alg"] = "argon2id"): KdfParams {
  if (alg === "pbkdf2-sha256") {
    return { alg, iterations: PBKDF2_ITERATIONS, salt: newSalt() };
  }
  return {
    alg: "argon2id",
    memKiB: ARGON2_DEFAULTS.memKiB,
    iterations: ARGON2_DEFAULTS.iterations,
    parallelism: ARGON2_DEFAULTS.parallelism,
    salt: newSalt(),
  };
}

async function deriveRawKey(secret: string, params: KdfParams): Promise<Uint8Array> {
  const salt = base64ToBytes(params.salt);
  if (params.alg === "argon2id") {
    const hash = await argon2id({
      password: secret,
      salt,
      parallelism: params.parallelism ?? ARGON2_DEFAULTS.parallelism,
      iterations: params.iterations,
      memorySize: params.memKiB ?? ARGON2_DEFAULTS.memKiB,
      hashLength: KEY_BYTES,
      outputType: "binary",
    });
    return new Uint8Array(hash);
  }

  // PBKDF2-SHA-256 fallback through Web Crypto.
  const baseKey = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(secret).buffer as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt.buffer as ArrayBuffer,
      iterations: params.iterations,
    },
    baseKey,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

/** Derive a non-extractable AES-GCM key-encryption key (KEK) from a secret + params. */
export async function deriveKek(secret: string, params: KdfParams): Promise<CryptoKey> {
  const raw = await deriveRawKey(secret, params);
  try {
    return await importAesKey(raw);
  } finally {
    raw.fill(0);
  }
}

/** Returns true if Argon2id WASM is usable in this runtime. */
export async function argon2Available(): Promise<boolean> {
  try {
    await argon2id({
      password: "probe",
      salt: randomBytes(SALT_BYTES),
      parallelism: 1,
      iterations: 1,
      memorySize: 1024,
      hashLength: KEY_BYTES,
      outputType: "binary",
    });
    return true;
  } catch {
    return false;
  }
}
