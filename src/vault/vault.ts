// Vault crypto orchestration: create, unlock, encrypt/decrypt body, re-envelope.
// The decrypted VaultData and the in-memory vault CryptoKey never touch disk.

import type {
  CredentialDraft,
  CredentialItem,
  EncryptedVaultFile,
  KdfParams,
  VaultData,
} from "@/lib/types";
import { VAULT_FORMAT_VERSION, VAULT_SCHEMA_VERSION } from "@/lib/types";
import { AppError } from "@/lib/errors";
import { bytesToUtf8, utf8ToBytes } from "@/lib/encoding";
import { aesDecrypt, aesEncrypt, generateAesKey } from "@/crypto/aesgcm";
import { unwrapVaultKey, wrapVaultKey } from "@/crypto/envelopes";
import { generateRecoveryKey } from "@/crypto/recoveryKey";
import { randomId } from "@/crypto/random";
import { encryptedVaultFileSchema, vaultDataSchema } from "./schema";

export interface UnlockedVault {
  key: CryptoKey;
  data: VaultData;
  file: EncryptedVaultFile;
}

export interface CreateVaultResult {
  file: EncryptedVaultFile;
  recoveryKey: string;
  unlocked: UnlockedVault;
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyVaultData(): VaultData {
  return { version: VAULT_SCHEMA_VERSION, items: [] };
}

async function encryptBody(key: CryptoKey, data: VaultData) {
  return aesEncrypt(key, utf8ToBytes(JSON.stringify(data)));
}

/** Create a brand new vault with master-password + recovery-key envelopes. */
export async function createVault(
  masterPassword: string,
  kdfAlg: KdfParams["alg"] = "argon2id",
): Promise<CreateVaultResult> {
  const recoveryKey = generateRecoveryKey();
  const vaultKey = await generateAesKey();
  const data = emptyVaultData();

  const [masterEnvelope, recoveryEnvelope, body] = await Promise.all([
    wrapVaultKey(vaultKey, masterPassword, kdfAlg),
    wrapVaultKey(vaultKey, recoveryKey, kdfAlg),
    encryptBody(vaultKey, data),
  ]);

  const ts = nowIso();
  const file: EncryptedVaultFile = {
    format: VAULT_FORMAT_VERSION,
    schema: VAULT_SCHEMA_VERSION,
    envelopes: { masterPassword: masterEnvelope, recoveryKey: recoveryEnvelope },
    body,
    createdAt: ts,
    updatedAt: ts,
    vectorClock: 1,
  };

  return { file, recoveryKey, unlocked: { key: vaultKey, data, file } };
}

/** Validate a parsed object as an EncryptedVaultFile, throwing typed errors. */
export function parseVaultFile(raw: unknown): EncryptedVaultFile {
  const result = encryptedVaultFileSchema.safeParse(raw);
  if (!result.success) {
    if (
      raw &&
      typeof raw === "object" &&
      "format" in raw &&
      (raw as { format: unknown }).format !== VAULT_FORMAT_VERSION
    ) {
      throw new AppError("VAULT_INCOMPATIBLE", "Vault file format is not supported.");
    }
    throw new AppError("VAULT_CORRUPT", "Vault file is corrupt or unreadable.");
  }
  return result.data as EncryptedVaultFile;
}

async function decryptBody(key: CryptoKey, file: EncryptedVaultFile): Promise<VaultData> {
  let json: string;
  try {
    json = bytesToUtf8(await aesDecrypt(key, file.body));
  } catch (cause) {
    throw new AppError("VAULT_CORRUPT", "Vault body failed authentication.", cause);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new AppError("VAULT_CORRUPT", "Vault body is not valid JSON.", cause);
  }
  const result = vaultDataSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError("VAULT_CORRUPT", "Vault body schema mismatch.");
  }
  return result.data as VaultData;
}

/** Unlock with a secret against a specific envelope. Wrong secret => AppError WRONG_SECRET. */
export async function unlockVault(
  file: EncryptedVaultFile,
  secret: string,
  envelopeId: "masterPassword" | "recoveryKey" = "masterPassword",
): Promise<UnlockedVault> {
  const vaultKey = await unwrapVaultKey(file.envelopes[envelopeId], secret);
  const data = await decryptBody(vaultKey, file);
  return { key: vaultKey, data, file };
}

/**
 * Re-open a (possibly newer) vault file using an already-held vault key, e.g.
 * after adopting a remote revision while still unlocked. Throws VAULT_CORRUPT
 * if the key does not match the file (different vault key after a remote reset).
 */
export async function openWithKey(
  file: EncryptedVaultFile,
  key: CryptoKey,
): Promise<UnlockedVault> {
  const data = await decryptBody(key, file);
  return { key, data, file };
}

/** Re-encrypt vault data with the in-memory key and bump timestamps + clock. */
export async function reencryptVault(
  unlocked: UnlockedVault,
  nextData: VaultData,
): Promise<UnlockedVault> {
  const body = await encryptBody(unlocked.key, nextData);
  const file: EncryptedVaultFile = {
    ...unlocked.file,
    body,
    updatedAt: nowIso(),
    vectorClock: unlocked.file.vectorClock + 1,
  };
  return { key: unlocked.key, data: nextData, file };
}

/** Replace the master-password envelope (used by change-password and recovery flows). */
export async function setMasterPassword(
  unlocked: UnlockedVault,
  newMasterPassword: string,
  kdfAlg: KdfParams["alg"] = "argon2id",
): Promise<UnlockedVault> {
  const masterEnvelope = await wrapVaultKey(unlocked.key, newMasterPassword, kdfAlg);
  const file: EncryptedVaultFile = {
    ...unlocked.file,
    envelopes: { ...unlocked.file.envelopes, masterPassword: masterEnvelope },
    updatedAt: nowIso(),
    vectorClock: unlocked.file.vectorClock + 1,
  };
  return { ...unlocked, file };
}

// ---- Credential operations on decrypted data (pure) ----

export function addCredential(data: VaultData, draft: CredentialDraft): VaultData {
  const ts = nowIso();
  const item: CredentialItem = { ...draft, id: randomId(), createdAt: ts, updatedAt: ts };
  return { ...data, items: [...data.items, item] };
}

export function updateCredential(
  data: VaultData,
  id: string,
  patch: Partial<CredentialDraft>,
): VaultData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === id ? { ...item, ...patch, updatedAt: nowIso() } : item,
    ),
  };
}

export function deleteCredential(data: VaultData, id: string): VaultData {
  return { ...data, items: data.items.filter((item) => item.id !== id) };
}

export function duplicateCredential(data: VaultData, id: string): VaultData {
  const source = data.items.find((item) => item.id === id);
  if (!source) return data;
  const ts = nowIso();
  const copy: CredentialItem = {
    ...source,
    id: randomId(),
    title: `${source.title} (copy)`,
    favorite: false,
    createdAt: ts,
    updatedAt: ts,
  };
  return { ...data, items: [...data.items, copy] };
}

export function toggleFavorite(data: VaultData, id: string): VaultData {
  return {
    ...data,
    items: data.items.map((item) =>
      item.id === id ? { ...item, favorite: !item.favorite, updatedAt: nowIso() } : item,
    ),
  };
}
