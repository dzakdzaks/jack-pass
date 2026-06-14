import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { EncryptedVaultFile, SyncMeta } from "@/lib/types";

vi.mock("@/storage/drive/driveClient", () => ({
  updateVaultFile: vi.fn(),
  findVaultFile: vi.fn(),
  createVaultFile: vi.fn(),
}));

vi.mock("@/storage/idb/db", () => ({
  saveSyncMeta: vi.fn(async (meta: SyncMeta) => meta),
}));

import {
  createVaultFile,
  findVaultFile,
  updateVaultFile,
} from "@/storage/drive/driveClient";
import { pushLocal } from "@/features/sync/syncService";

const file = { vectorClock: 1 } as EncryptedVaultFile;
const staleMeta: SyncMeta = {
  driveFileId: "stale-id",
  lastSyncedRevision: "rev-old",
  lastSyncedAt: "2026-01-01T00:00:00.000Z",
  lastSyncedClock: 0,
  dirty: true,
  googleLinked: true,
};

describe("pushLocal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recreates the vault file when a stored driveFileId no longer exists", async () => {
    vi.mocked(updateVaultFile).mockRejectedValueOnce(
      new AppError("DRIVE_NOT_FOUND", "Drive file not found."),
    );
    vi.mocked(findVaultFile).mockResolvedValueOnce(null);
    vi.mocked(createVaultFile).mockResolvedValueOnce({
      id: "new-id",
      name: "vault.enc.json",
      headRevisionId: "rev-new",
    });

    const next = await pushLocal("token", file, staleMeta);

    expect(updateVaultFile).toHaveBeenCalledWith("token", "stale-id", file);
    expect(findVaultFile).toHaveBeenCalledWith("token");
    expect(createVaultFile).toHaveBeenCalledWith("token", file);
    expect(next.driveFileId).toBe("new-id");
    expect(next.lastSyncedRevision).toBe("rev-new");
    expect(next.dirty).toBe(false);
  });
});
