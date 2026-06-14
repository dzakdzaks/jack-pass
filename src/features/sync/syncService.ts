// Sync orchestration between the IndexedDB cache and Google Drive (PRD 10 Sync,
// PRD 9 Conflict). Drive is cloud source of truth; IDB is the local encrypted cache.

import type { EncryptedVaultFile, SyncMeta } from "@/lib/types";
import { AppError } from "@/lib/errors";
import {
  createVaultFile,
  downloadVault,
  findVaultFile,
  getFileRef,
  updateVaultFile,
  type DriveFileRef,
} from "@/storage/drive/driveClient";
import { loadSyncMeta, saveSyncMeta } from "@/storage/idb/db";

export type RemoteStatus = "absent" | "unchanged" | "changed";

export interface RemoteProbe {
  status: RemoteStatus;
  ref: DriveFileRef | null;
}

/** Determine whether the remote vault changed since our last successful sync. */
export async function probeRemote(token: string, meta: SyncMeta): Promise<RemoteProbe> {
  const ref = meta.driveFileId
    ? await getFileRef(token, meta.driveFileId).catch((err) => {
        if (err instanceof AppError && err.code === "DRIVE_NOT_FOUND") return null;
        throw err;
      })
    : await findVaultFile(token);

  if (!ref) return { status: "absent", ref: null };
  const changed = ref.headRevisionId !== meta.lastSyncedRevision;
  return { status: changed ? "changed" : "unchanged", ref };
}

export async function pullRemote(token: string, ref: DriveFileRef): Promise<EncryptedVaultFile> {
  return downloadVault(token, ref.id);
}

/** Find or create the vault file on Drive. */
async function upsertRemoteVault(
  token: string,
  file: EncryptedVaultFile,
): Promise<DriveFileRef> {
  const existing = await findVaultFile(token);
  return existing
    ? await updateVaultFile(token, existing.id, file)
    : await createVaultFile(token, file);
}

/** Update a known file id, or recreate if Drive no longer has it. */
async function updateOrRecreateVault(
  token: string,
  fileId: string,
  file: EncryptedVaultFile,
): Promise<DriveFileRef> {
  try {
    return await updateVaultFile(token, fileId, file);
  } catch (err) {
    if (err instanceof AppError && err.code === "DRIVE_NOT_FOUND") {
      return upsertRemoteVault(token, file);
    }
    throw err;
  }
}

/** Push local file to Drive (create or update) and persist updated sync meta. */
export async function pushLocal(
  token: string,
  file: EncryptedVaultFile,
  meta: SyncMeta,
): Promise<SyncMeta> {
  const ref = meta.driveFileId
    ? await updateOrRecreateVault(token, meta.driveFileId, file)
    : await upsertRemoteVault(token, file);

  const next: SyncMeta = {
    ...meta,
    driveFileId: ref.id,
    lastSyncedRevision: ref.headRevisionId ?? null,
    lastSyncedAt: new Date().toISOString(),
    lastSyncedClock: file.vectorClock,
    dirty: false,
  };
  await saveSyncMeta(next);
  return next;
}

/** Mark the local cache dirty (unsynced changes pending). */
export async function markDirty(): Promise<SyncMeta> {
  const meta = await loadSyncMeta();
  const next = { ...meta, dirty: true };
  await saveSyncMeta(next);
  return next;
}
