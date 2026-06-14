// Shared domain + persistence types for JackPass.
// See IMPLEMENTATION-PLAN.md sections 5 (crypto) and 6 (vault data model).

export const VAULT_FORMAT_VERSION = 1 as const;
export const VAULT_SCHEMA_VERSION = 1 as const;

export type KdfAlgorithm = "argon2id" | "pbkdf2-sha256";

export interface KdfParams {
  alg: KdfAlgorithm;
  /** Argon2id memory cost in KiB. Omitted for PBKDF2. */
  memKiB?: number;
  /** Argon2id iterations / time cost, or PBKDF2 iteration count. */
  iterations: number;
  /** Argon2id parallelism lanes. Omitted for PBKDF2. */
  parallelism?: number;
  /** Base64 salt. */
  salt: string;
}

/** AES-GCM ciphertext container. iv and ct are base64. */
export interface AesGcmBlob {
  alg: "AES-GCM";
  iv: string;
  ct: string;
}

/** Wraps the vault data encryption key under a key-encryption key derived from a secret. */
export interface KeyEnvelope extends AesGcmBlob {
  kdf: KdfParams;
}

export type EnvelopeId = "masterPassword" | "recoveryKey";

/**
 * The encrypted vault file as stored in Google Drive appDataFolder and the IndexedDB cache.
 * Only metadata is plaintext (PRD 8 "Store only encryption metadata in plaintext").
 */
export interface EncryptedVaultFile {
  format: typeof VAULT_FORMAT_VERSION;
  schema: number;
  envelopes: Record<EnvelopeId, KeyEnvelope>;
  body: AesGcmBlob;
  createdAt: string;
  updatedAt: string;
  /** Monotonic local counter; used alongside Drive revision for conflict detection. */
  vectorClock: number;
}

/** Decrypted credential record. All of these fields are sensitive and live only in memory while unlocked. */
export interface CredentialItem {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Decrypted vault payload (the plaintext that gets encrypted into EncryptedVaultFile.body). */
export interface VaultData {
  version: typeof VAULT_SCHEMA_VERSION;
  items: CredentialItem[];
}

export type CredentialDraft = Omit<
  CredentialItem,
  "id" | "createdAt" | "updatedAt"
>;

/** Sync bookkeeping stored (non-sensitive) in IndexedDB. */
export interface SyncMeta {
  /** Google Drive fileId of the vault file, once known. */
  driveFileId: string | null;
  /** Drive headRevisionId observed at last successful sync. */
  lastSyncedRevision: string | null;
  /** ISO timestamp of last successful Drive sync. */
  lastSyncedAt: string | null;
  /** vectorClock value last pushed to Drive. */
  lastSyncedClock: number;
  /** True when local cache has changes not yet pushed to Drive. */
  dirty: boolean;
  /** True after the user has linked Google; used to restore sign-in on refresh. */
  googleLinked: boolean;
}
