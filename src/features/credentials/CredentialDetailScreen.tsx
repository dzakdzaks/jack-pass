import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useVault } from "@/features/vault/vaultStore";
import { Button } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { Modal } from "@/ui/Modal";
import { copyToClipboard } from "@/lib/clipboard";

export function CredentialDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const item = useVault((s) => s.unlocked?.data.items.find((i) => i.id === id));
  const removeItem = useVault((s) => s.removeItem);
  const duplicateItem = useVault((s) => s.duplicateItem);
  const favoriteItem = useVault((s) => s.favoriteItem);
  const [revealed, setRevealed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-[48px] text-[15px] text-muted">
        Credential not found.
      </div>
    );
  }

  async function copy(label: string, value: string) {
    if (!value) return;
    await copyToClipboard(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleDelete() {
    await removeItem(item!.id);
    setConfirmDelete(false);
    navigate("/");
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-[24px] p-[24px]">
      <div className="flex items-center gap-[12px]">
        <button
          type="button"
          onClick={() => navigate("/")}
          aria-label="Back"
          className="rounded-[100px] px-[12px] py-[6px] text-[14px] font-semibold text-primary hover:bg-surface-soft sm:hidden"
        >
          ← Back
        </button>
        <span className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-surface-strong text-[20px] font-semibold text-ink">
          {(item.title || "?").charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[24px] font-normal tracking-[-0.4px] text-ink">
            {item.title || "Untitled"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void favoriteItem(item.id)}
          aria-pressed={item.favorite}
          aria-label={item.favorite ? "Unfavorite" : "Favorite"}
          className="text-[22px] text-accent-yellow"
        >
          {item.favorite ? "★" : "☆"}
        </button>
      </div>

      <div className="flex flex-col gap-[12px]">
        <DetailRow label="Username" value={item.username} onCopy={() => copy("username", item.username)} copied={copied === "username"} />
        <DetailRow
          label="Password"
          value={revealed ? item.password : item.password ? "••••••••••••" : ""}
          mono
          onCopy={() => copy("password", item.password)}
          copied={copied === "password"}
          extra={
            item.password ? (
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="text-[13px] font-semibold text-primary"
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
            ) : null
          }
        />
        <DetailRow
          label="Website"
          value={item.url}
          onCopy={() => copy("url", item.url)}
          copied={copied === "url"}
          extra={
            item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[13px] font-semibold text-primary"
              >
                Open
              </a>
            ) : null
          }
        />
        {item.notes && (
          <div className="rounded-[16px] border border-hairline p-[16px]">
            <p className="mb-[6px] text-[13px] font-semibold text-muted">Notes</p>
            <p className="whitespace-pre-wrap text-[15px] text-ink">{item.notes}</p>
          </div>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-[8px]">
            {item.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-[12px]">
        <Button onClick={() => navigate(`/credentials/${item.id}/edit`)}>Edit</Button>
        <Button variant="outline" onClick={() => void duplicateItem(item.id)}>
          Duplicate
        </Button>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <p className="text-[12px] text-muted">
        Updated {new Date(item.updatedAt).toLocaleString()}
      </p>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete credential?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-body">
          This will permanently remove “{item.title || "Untitled"}” from your vault.
        </p>
      </Modal>
    </div>
  );
}

function DetailRow({
  label,
  value,
  onCopy,
  copied,
  mono,
  extra,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-[12px] rounded-[16px] border border-hairline p-[16px]">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-muted">{label}</p>
        <p className={`truncate text-[15px] text-ink ${mono ? "tabular" : ""}`}>{value || "—"}</p>
      </div>
      {extra}
      {value && (
        <button
          type="button"
          onClick={onCopy}
          className="rounded-[100px] bg-surface-strong px-[14px] py-[8px] text-[13px] font-semibold text-ink hover:bg-hairline"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
