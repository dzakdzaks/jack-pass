// Key envelopes wrap the 256-bit vault data key under a KEK derived from a
// secret (master password or recovery key). See IMPLEMENTATION-PLAN.md section 5.

import type { KdfParams, KeyEnvelope } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { aesDecrypt, aesEncrypt, exportAesKey, importAesKey } from "./aesgcm";
import { deriveKek, defaultKdfParams } from "./kdf";

/** Wrap a vault key into an envelope using a freshly-salted KEK derived from `secret`. */
export async function wrapVaultKey(
  vaultKey: CryptoKey,
  secret: string,
  kdfAlg: KdfParams["alg"] = "argon2id",
): Promise<KeyEnvelope> {
  const kdf = defaultKdfParams(kdfAlg);
  const kek = await deriveKek(secret, kdf);
  const rawVaultKey = await exportAesKey(vaultKey);
  try {
    const blob = await aesEncrypt(kek, rawVaultKey);
    return { ...blob, kdf };
  } finally {
    rawVaultKey.fill(0);
  }
}

/**
 * Unwrap a vault key from an envelope. Throws AppError("WRONG_SECRET") when the
 * GCM auth tag fails, i.e. the supplied secret is incorrect.
 */
export async function unwrapVaultKey(
  envelope: KeyEnvelope,
  secret: string,
): Promise<CryptoKey> {
  const kek = await deriveKek(secret, envelope.kdf);
  let raw: Uint8Array;
  try {
    raw = await aesDecrypt(kek, envelope);
  } catch (cause) {
    throw new AppError("WRONG_SECRET", "Unable to unlock with the provided secret.", cause);
  }
  try {
    return await importAesKey(raw);
  } finally {
    raw.fill(0);
  }
}
