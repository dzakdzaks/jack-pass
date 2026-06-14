// Central application state: vault lifecycle, in-memory unlocked data, and sync.
// The unlocked vault key + decrypted data live only here, in memory, and are
// cleared on lock / sign-out / reset (PRD 8).

import { create } from "zustand";
import type {
  CredentialDraft,
  EncryptedVaultFile,
  SyncMeta,
  VaultData,
} from "@/lib/types";
import { AppError, isAppError } from "@/lib/errors";
import {
  addCredential,
  createVault,
  deleteCredential,
  duplicateCredential,
  openWithKey,
  parseVaultFile,
  reencryptVault,
  setMasterPassword,
  toggleFavorite,
  unlockVault,
  updateCredential,
  type UnlockedVault,
} from "@/vault/vault";
import { encryptedVaultFileSchema } from "@/vault/schema";
import {
  archiveVault,
  clearCachedVault,
  clearSyncMeta,
  loadCachedVault,
  loadSyncMeta,
  migrateLegacyVaultIfNeeded,
  saveCachedVault,
  saveSyncMeta,
  DEFAULT_SYNC_META,
} from "@/storage/idb/db";
import {
  getActiveAccountKey,
  setActiveAccountKey,
} from "@/storage/accountScope";
import {
  archiveRemoteVault,
  deleteRemoteVault,
  findVaultFile,
} from "@/storage/drive/driveClient";
import {
  pullRemote,
  pushLocal,
  probeRemote,
} from "@/features/sync/syncService";
import { useAuth } from "@/features/auth/authStore";
import { useSettings } from "@/features/settings/settingsStore";

export type VaultPhase = "booting" | "no-vault" | "locked" | "unlocked";

interface ConflictState {
  local: EncryptedVaultFile;
  remote: EncryptedVaultFile;
  remoteFileId: string;
  remoteRevision: string | null;
}

interface VaultStore {
  phase: VaultPhase;
  cachedFile: EncryptedVaultFile | null;
  unlocked: UnlockedVault | null;
  syncMeta: SyncMeta;
  online: boolean;
  syncing: boolean;
  syncError: string | null;
  conflict: ConflictState | null;
  /** Recovery key to show once after create/reset; cleared after acknowledgement. */
  pendingRecoveryKey: string | null;

  bootstrap: () => Promise<void>;
  /** Load vault data for a Google account or local-only namespace. */
  switchAccount: (accountKey: string) => Promise<void>;
  setOnline: (online: boolean) => void;

  createNewVault: (masterPassword: string) => Promise<void>;
  unlock: (masterPassword: string) => Promise<void>;
  recoverWithKey: (
    recoveryKey: string,
    newMasterPassword: string,
  ) => Promise<void>;
  resetVault: (newMasterPassword: string) => Promise<void>;
  deleteVault: (masterPassword: string) => Promise<void>;
  changeMasterPassword: (current: string, next: string) => Promise<void>;
  lock: () => void;
  acknowledgeRecoveryKey: () => void;

  addItem: (draft: CredentialDraft) => Promise<void>;
  editItem: (id: string, patch: Partial<CredentialDraft>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  favoriteItem: (id: string) => Promise<void>;

  syncNow: () => Promise<void>;
  resolveConflict: (choice: "local" | "remote") => Promise<void>;

  exportVault: () => EncryptedVaultFile | null;
  importVault: (raw: unknown) => Promise<void>;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 2_000;

function nowIso(): string {
  return new Date().toISOString();
}

export const useVault = create<VaultStore>((set, get) => {
  function scheduleSync(): void {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      void get().syncNow();
    }, SYNC_DEBOUNCE_MS);
  }

  // Persist a new encrypted file locally, mark dirty, and schedule a push.
  async function commitFile(
    file: EncryptedVaultFile,
    unlocked: UnlockedVault | null,
  ): Promise<void> {
    await saveCachedVault(file);
    const meta = { ...get().syncMeta, dirty: true };
    await saveSyncMeta(meta);
    set({ cachedFile: file, unlocked, syncMeta: meta });
    scheduleSync();
  }

  async function mutateData(
    transform: (data: VaultData) => VaultData,
  ): Promise<void> {
    const { unlocked } = get();
    if (!unlocked) throw new AppError("UNKNOWN", "Vault is locked.");
    const nextData = transform(unlocked.data);
    const nextUnlocked = await reencryptVault(unlocked, nextData);
    await commitFile(nextUnlocked.file, nextUnlocked);
  }

  async function loadAccountState(accountKey: string): Promise<void> {
    const [cachedFile, syncMeta] = await Promise.all([
      loadCachedVault(accountKey),
      loadSyncMeta(accountKey),
    ]);
    set({
      unlocked: null,
      cachedFile,
      syncMeta,
      conflict: null,
      syncError: null,
      pendingRecoveryKey: null,
      phase: cachedFile ? "locked" : "no-vault",
    });
  }

  return {
    phase: "booting",
    cachedFile: null,
    unlocked: null,
    syncMeta: { ...DEFAULT_SYNC_META },
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    syncing: false,
    syncError: null,
    conflict: null,
    pendingRecoveryKey: null,

    bootstrap: async () => {
      if (useAuth.getState().configured) {
        await useAuth.getState().restoreCachedSession();
      } else {
        useAuth.setState({ sessionChecked: true });
      }

      const accountKey = getActiveAccountKey();
      await migrateLegacyVaultIfNeeded(accountKey);

      if (useAuth.getState().configured && !useAuth.getState().signedIn) {
        set({
          unlocked: null,
          cachedFile: null,
          syncMeta: { ...DEFAULT_SYNC_META },
          conflict: null,
          syncError: null,
          pendingRecoveryKey: null,
          phase: "no-vault",
        });
        return;
      }

      await loadAccountState(accountKey);
      if (useAuth.getState().signedIn) void get().syncNow();
    },

    switchAccount: async (accountKey) => {
      if (syncTimer) clearTimeout(syncTimer);
      setActiveAccountKey(accountKey);
      await migrateLegacyVaultIfNeeded(accountKey);
      await loadAccountState(accountKey);
    },

    setOnline: (online) => {
      set({ online });
      if (online && get().syncMeta.dirty) scheduleSync();
    },

    createNewVault: async (masterPassword) => {
      const kdf = useSettings.getState().kdf;
      const { file, recoveryKey, unlocked } = await createVault(
        masterPassword,
        kdf,
      );
      await saveCachedVault(file);
      const meta = {
        ...DEFAULT_SYNC_META,
        dirty: true,
        googleLinked: useAuth.getState().signedIn,
      };
      await saveSyncMeta(meta);
      set({
        cachedFile: file,
        unlocked,
        syncMeta: meta,
        phase: "unlocked",
        pendingRecoveryKey: recoveryKey,
      });
      scheduleSync();
    },

    unlock: async (masterPassword) => {
      const { cachedFile } = get();
      if (!cachedFile) throw new AppError("NO_VAULT", "No vault to unlock.");
      const unlocked = await unlockVault(
        cachedFile,
        masterPassword,
        "masterPassword",
      );
      set({ unlocked, phase: "unlocked" });
    },

    recoverWithKey: async (recoveryKey, newMasterPassword) => {
      const { cachedFile } = get();
      if (!cachedFile) throw new AppError("NO_VAULT", "No vault to recover.");
      const unlocked = await unlockVault(
        cachedFile,
        recoveryKey,
        "recoveryKey",
      );
      const kdf = useSettings.getState().kdf;
      const rewrapped = await setMasterPassword(
        unlocked,
        newMasterPassword,
        kdf,
      );
      await commitFile(rewrapped.file, rewrapped);
      set({ phase: "unlocked" });
    },

    resetVault: async (newMasterPassword) => {
      const { cachedFile, syncMeta } = get();
      // Preserve the old encrypted vault locally and (best effort) on Drive.
      if (cachedFile) {
        await archiveVault(cachedFile);
        const auth = useAuth.getState();
        if (auth.signedIn && navigator.onLine) {
          try {
            const token = await auth.ensureToken();
            await archiveRemoteVault(token, cachedFile);
          } catch {
            // Archive on Drive is best-effort; local archive already succeeded.
          }
        }
      }
      const kdf = useSettings.getState().kdf;
      const { file, recoveryKey, unlocked } = await createVault(
        newMasterPassword,
        kdf,
      );
      await saveCachedVault(file);
      // Keep the existing driveFileId so the new vault overwrites the same file.
      const meta: SyncMeta = {
        ...DEFAULT_SYNC_META,
        driveFileId: syncMeta.driveFileId,
        dirty: true,
        googleLinked: useAuth.getState().signedIn,
      };
      await saveSyncMeta(meta);
      set({
        cachedFile: file,
        unlocked,
        syncMeta: meta,
        phase: "unlocked",
        pendingRecoveryKey: recoveryKey,
        conflict: null,
      });
      scheduleSync();
    },

    deleteVault: async (masterPassword) => {
      const { cachedFile, syncMeta } = get();
      if (!cachedFile) throw new AppError("NO_VAULT", "No vault to delete.");

      await unlockVault(cachedFile, masterPassword, "masterPassword");

      if (syncTimer) clearTimeout(syncTimer);

      await archiveVault(cachedFile);

      const auth = useAuth.getState();
      if (auth.signedIn && navigator.onLine) {
        try {
          const token = await auth.ensureToken();
          const fileId =
            syncMeta.driveFileId ?? (await findVaultFile(token))?.id;
          if (fileId) await deleteRemoteVault(token, fileId);
        } catch {
          // Remote delete is best-effort; local data is already removed below.
        }
      }

      await clearCachedVault();
      await clearSyncMeta();

      set({
        unlocked: null,
        cachedFile: null,
        syncMeta: { ...DEFAULT_SYNC_META },
        conflict: null,
        syncError: null,
        pendingRecoveryKey: null,
        phase: "no-vault",
      });
    },

    changeMasterPassword: async (current, next) => {
      const { cachedFile } = get();
      if (!cachedFile) throw new AppError("UNKNOWN", "No vault loaded.");
      // Verify current password before changing.
      await unlockVault(cachedFile, current, "masterPassword");
      const { unlocked } = get();
      if (!unlocked) throw new AppError("UNKNOWN", "Vault is locked.");
      const kdf = useSettings.getState().kdf;
      const rewrapped = await setMasterPassword(unlocked, next, kdf);
      await commitFile(rewrapped.file, rewrapped);
    },

    lock: () => {
      set({ unlocked: null, phase: get().cachedFile ? "locked" : "no-vault" });
    },

    acknowledgeRecoveryKey: () => set({ pendingRecoveryKey: null }),

    addItem: (draft) => mutateData((data) => addCredential(data, draft)),
    editItem: (id, patch) =>
      mutateData((data) => updateCredential(data, id, patch)),
    removeItem: (id) => mutateData((data) => deleteCredential(data, id)),
    duplicateItem: (id) => mutateData((data) => duplicateCredential(data, id)),
    favoriteItem: (id) => mutateData((data) => toggleFavorite(data, id)),

    syncNow: async () => {
      const { cachedFile, syncMeta } = get();
      const auth = useAuth.getState();
      if (!navigator.onLine) {
        set({ online: false });
        return;
      }
      if (!auth.configured) return;
      if (!auth.signedIn) return;
      if (get().syncing) return;

      set({ syncing: true, syncError: null });
      try {
        const token = await auth.ensureToken();
        const probe = await probeRemote(token, syncMeta);

        // New device / cleared cache: pull the remote vault even when revision is unchanged.
        if (!cachedFile && probe.ref) {
          const remote = await pullRemote(token, probe.ref);
          const meta: SyncMeta = {
            ...syncMeta,
            driveFileId: probe.ref.id,
            lastSyncedRevision: probe.ref.headRevisionId ?? null,
            lastSyncedAt: nowIso(),
            lastSyncedClock: remote.vectorClock,
            dirty: false,
          };
          await saveCachedVault(remote);
          await saveSyncMeta(meta);
          await adoptFile(remote, meta);
          return;
        }

        if (probe.status === "changed" && probe.ref) {
          const remote = await pullRemote(token, probe.ref);
          if (syncMeta.dirty && cachedFile) {
            set({
              conflict: {
                local: cachedFile,
                remote,
                remoteFileId: probe.ref.id,
                remoteRevision: probe.ref.headRevisionId ?? null,
              },
            });
            return;
          }
          await saveCachedVault(remote);
          const meta: SyncMeta = {
            ...syncMeta,
            driveFileId: probe.ref.id,
            lastSyncedRevision: probe.ref.headRevisionId ?? null,
            lastSyncedAt: nowIso(),
            lastSyncedClock: remote.vectorClock,
            dirty: false,
          };
          await saveSyncMeta(meta);
          await adoptFile(remote, meta);
          return;
        }

        if (probe.status === "absent" || syncMeta.dirty) {
          if (!cachedFile) return;
          const meta = await pushLocal(token, cachedFile, syncMeta);
          set({ syncMeta: meta });
        }
      } catch (err) {
        set({ syncError: isAppError(err) ? err.message : "Sync failed." });
      } finally {
        set({ syncing: false });
      }
    },

    resolveConflict: async (choice) => {
      const { conflict, syncMeta } = get();
      if (!conflict) return;
      const auth = useAuth.getState();
      try {
        const token = await auth.ensureToken();
        if (choice === "remote") {
          await saveCachedVault(conflict.remote);
          const meta: SyncMeta = {
            ...syncMeta,
            driveFileId: conflict.remoteFileId,
            lastSyncedRevision: conflict.remoteRevision,
            lastSyncedAt: nowIso(),
            lastSyncedClock: conflict.remote.vectorClock,
            dirty: false,
          };
          await saveSyncMeta(meta);
          await adoptFile(conflict.remote, meta);
        } else {
          // Keep local: overwrite the remote file with our local version.
          const meta = await pushLocal(token, conflict.local, {
            ...syncMeta,
            driveFileId: conflict.remoteFileId,
          });
          set({ syncMeta: meta });
        }
        set({ conflict: null });
      } catch (err) {
        set({
          syncError: isAppError(err)
            ? err.message
            : "Conflict resolution failed.",
        });
      }
    },

    exportVault: () => get().cachedFile,

    importVault: async (raw) => {
      const file = parseVaultFile(raw);
      await saveCachedVault(file);
      const meta = {
        ...DEFAULT_SYNC_META,
        dirty: true,
        googleLinked: useAuth.getState().signedIn,
      };
      await saveSyncMeta(meta);
      set({
        cachedFile: file,
        unlocked: null,
        syncMeta: meta,
        phase: "locked",
      });
      scheduleSync();
    },
  };

  // --- internal helpers that need set/get ---
  async function adoptFile(
    file: EncryptedVaultFile,
    meta: SyncMeta,
  ): Promise<void> {
    const { unlocked } = get();
    if (unlocked) {
      try {
        const reopened = await openWithKey(file, unlocked.key);
        set({ cachedFile: file, syncMeta: meta, unlocked: reopened });
        return;
      } catch {
        // The remote vault uses a different key (e.g. reset elsewhere); force re-unlock.
        set({
          cachedFile: file,
          syncMeta: meta,
          unlocked: null,
          phase: "locked",
        });
        return;
      }
    }
    set({ cachedFile: file, syncMeta: meta, phase: "locked" });
  }
});

// Validate an imported object eagerly so callers can show errors before commit.
export function isValidVaultFile(raw: unknown): boolean {
  return encryptedVaultFileSchema.safeParse(raw).success;
}
