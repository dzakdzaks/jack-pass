// Compact sync status indicator (PRD 11 "Sync status must be visible").

import { useVault } from "@/features/vault/vaultStore";
import { useAuth } from "@/features/auth/authStore";

export function SyncStatus() {
  const online = useVault((s) => s.online);
  const syncing = useVault((s) => s.syncing);
  const dirty = useVault((s) => s.syncMeta.dirty);
  const lastSyncedAt = useVault((s) => s.syncMeta.lastSyncedAt);
  const syncError = useVault((s) => s.syncError);
  const syncNow = useVault((s) => s.syncNow);
  const configured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => s.signedIn);

  let label: string;
  let tone = "text-muted";

  if (!configured) {
    label = "Local only";
  } else if (!online) {
    label = "Offline";
    tone = "text-semantic-down";
  } else if (syncError) {
    label = "Sync error";
    tone = "text-semantic-down";
  } else if (syncing) {
    label = "Syncing…";
  } else if (!signedIn) {
    label = "Not signed in";
  } else if (dirty) {
    label = "Pending changes";
    tone = "text-accent-yellow";
  } else if (lastSyncedAt) {
    label = "Synced";
    tone = "text-semantic-up";
  } else {
    label = "Ready";
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={
        syncError ??
        (lastSyncedAt
          ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
          : label)
      }
      className={`inline-flex items-center gap-[6px] rounded-[100px] bg-surface-strong px-[12px] py-[6px] text-[12px] font-semibold ${tone}`}
    >
      <span aria-hidden className="h-[8px] w-[8px] rounded-full bg-current" />
      {label}
    </button>
  );
}
