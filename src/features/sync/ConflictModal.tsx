import { Modal } from "@/ui/Modal";
import { Button } from "@/ui/Button";
import { useVault } from "@/features/vault/vaultStore";

export function ConflictModal() {
  const conflict = useVault((s) => s.conflict);
  const resolveConflict = useVault((s) => s.resolveConflict);

  if (!conflict) return null;

  const localTime = new Date(conflict.local.updatedAt).toLocaleString();
  const remoteTime = new Date(conflict.remote.updatedAt).toLocaleString();

  return (
    <Modal
      open
      onClose={() => {
        /* Conflict must be resolved explicitly; closing is disabled. */
      }}
      title="Sync conflict"
    >
      <p className="text-[15px] text-body">
        This vault changed on another device while you had unsynced local changes. Choose which
        version to keep. The other version is preserved on Google Drive history.
      </p>
      <div className="flex flex-col gap-[8px] rounded-[12px] bg-surface-soft p-[16px] text-[14px]">
        <span className="text-ink">
          <strong>This device:</strong> updated {localTime}
        </span>
        <span className="text-ink">
          <strong>Google Drive:</strong> updated {remoteTime}
        </span>
      </div>
      <div className="flex flex-col gap-[12px]">
        <Button block onClick={() => void resolveConflict("local")}>
          Keep this device&apos;s version
        </Button>
        <Button variant="outline" block onClick={() => void resolveConflict("remote")}>
          Use Google Drive version
        </Button>
      </div>
    </Modal>
  );
}
