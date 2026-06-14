// IndexedDB persistence (PRD 8): stores ONLY encrypted vault blobs and
// non-sensitive sync metadata. No plaintext credential data is ever written.
// Vault + meta are keyed per account (Google sub or "local").

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EncryptedVaultFile, SyncMeta } from "@/lib/types";
import { getActiveAccountKey } from "@/storage/accountScope";

const DB_NAME = "jackpass";
const DB_VERSION = 1;

const STORE_VAULT = "vault";
const STORE_META = "meta";
const STORE_ARCHIVE = "archive";

const LEGACY_VAULT_KEY = "current";
const LEGACY_META_KEY = "sync";

interface JackPassDB extends DBSchema {
  vault: { key: string; value: EncryptedVaultFile };
  meta: { key: string; value: SyncMeta };
  archive: { key: string; value: { id: string; archivedAt: string; file: EncryptedVaultFile } };
}

let dbPromise: Promise<IDBPDatabase<JackPassDB>> | null = null;

function db(): Promise<IDBPDatabase<JackPassDB>> {
  if (!dbPromise) {
    dbPromise = openDB<JackPassDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_VAULT)) {
          database.createObjectStore(STORE_VAULT);
        }
        if (!database.objectStoreNames.contains(STORE_META)) {
          database.createObjectStore(STORE_META);
        }
        if (!database.objectStoreNames.contains(STORE_ARCHIVE)) {
          database.createObjectStore(STORE_ARCHIVE, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

function vaultKey(accountKey: string): string {
  return `vault:${accountKey}`;
}

function metaKey(accountKey: string): string {
  return `meta:${accountKey}`;
}

export const DEFAULT_SYNC_META: SyncMeta = {
  driveFileId: null,
  lastSyncedRevision: null,
  lastSyncedAt: null,
  lastSyncedClock: 0,
  dirty: false,
  googleLinked: false,
};

/** Move pre-account-scoping data into the given account namespace once. */
export async function migrateLegacyVaultIfNeeded(
  targetAccountKey: string,
): Promise<void> {
  const database = await db();
  const legacyVault = await database.get(STORE_VAULT, LEGACY_VAULT_KEY);
  const legacyMeta = await database.get(STORE_META, LEGACY_META_KEY);
  if (!legacyVault && !legacyMeta) return;

  const nextVaultKey = vaultKey(targetAccountKey);
  const nextMetaKey = metaKey(targetAccountKey);

  const existingVault = await database.get(STORE_VAULT, nextVaultKey);
  if (!existingVault && legacyVault) {
    await database.put(STORE_VAULT, legacyVault, nextVaultKey);
  }

  const existingMeta = await database.get(STORE_META, nextMetaKey);
  if (!existingMeta && legacyMeta) {
    await database.put(STORE_META, legacyMeta, nextMetaKey);
  }

  if (legacyVault) await database.delete(STORE_VAULT, LEGACY_VAULT_KEY);
  if (legacyMeta) await database.delete(STORE_META, LEGACY_META_KEY);
}

export async function loadCachedVault(
  accountKey = getActiveAccountKey(),
): Promise<EncryptedVaultFile | null> {
  return (await (await db()).get(STORE_VAULT, vaultKey(accountKey))) ?? null;
}

export async function saveCachedVault(
  file: EncryptedVaultFile,
  accountKey = getActiveAccountKey(),
): Promise<void> {
  await (await db()).put(STORE_VAULT, file, vaultKey(accountKey));
}

export async function clearCachedVault(
  accountKey = getActiveAccountKey(),
): Promise<void> {
  await (await db()).delete(STORE_VAULT, vaultKey(accountKey));
}

export async function loadSyncMeta(
  accountKey = getActiveAccountKey(),
): Promise<SyncMeta> {
  const stored = await (await db()).get(STORE_META, metaKey(accountKey));
  if (!stored) return { ...DEFAULT_SYNC_META };
  const meta = { ...DEFAULT_SYNC_META, ...stored };
  if (
    stored.googleLinked === undefined &&
    (stored.driveFileId || stored.lastSyncedAt)
  ) {
    meta.googleLinked = true;
  }
  return meta;
}

export async function saveSyncMeta(
  meta: SyncMeta,
  options?: { allowClearGoogleLinked?: boolean },
  accountKey = getActiveAccountKey(),
): Promise<void> {
  const key = metaKey(accountKey);
  const existing = await (await db()).get(STORE_META, key);
  const merged: SyncMeta = { ...DEFAULT_SYNC_META, ...existing, ...meta };
  if (!options?.allowClearGoogleLinked && existing?.googleLinked) {
    merged.googleLinked = true;
  }
  await (await db()).put(STORE_META, merged, key);
}

export async function setGoogleLinked(
  linked: boolean,
  accountKey = getActiveAccountKey(),
): Promise<void> {
  const existing = await (await db()).get(STORE_META, metaKey(accountKey));
  const merged: SyncMeta = {
    ...DEFAULT_SYNC_META,
    ...existing,
    googleLinked: linked,
  };
  await saveSyncMeta(merged, { allowClearGoogleLinked: true }, accountKey);
}

export async function clearSyncMeta(
  accountKey = getActiveAccountKey(),
): Promise<void> {
  await (await db()).delete(STORE_META, metaKey(accountKey));
}

export async function archiveVault(
  file: EncryptedVaultFile,
  accountKey = getActiveAccountKey(),
): Promise<string> {
  const id = `vault.archived.${accountKey}.${Date.now()}`;
  await (await db()).put(STORE_ARCHIVE, {
    id,
    archivedAt: new Date().toISOString(),
    file,
  });
  return id;
}

export async function wipeAll(): Promise<void> {
  const database = await db();
  await Promise.all([
    database.clear(STORE_VAULT),
    database.clear(STORE_META),
  ]);
}
