import { useRef, useState } from "react";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Field } from "@/ui/Input";
import { PasswordField } from "@/ui/PasswordField";
import { useSettings } from "./settingsStore";
import { useVault } from "@/features/vault/vaultStore";
import { useAuth } from "@/features/auth/authStore";
import { errorMessage } from "@/lib/errorMessage";

const lockOptions = [
  { label: "1 minute", ms: 60_000 },
  { label: "5 minutes", ms: 5 * 60_000 },
  { label: "15 minutes", ms: 15 * 60_000 },
  { label: "30 minutes", ms: 30 * 60_000 },
];

export function SettingsScreen() {
  const settings = useSettings();
  const changeMasterPassword = useVault((s) => s.changeMasterPassword);
  const exportVault = useVault((s) => s.exportVault);
  const importVault = useVault((s) => s.importVault);
  const deleteVault = useVault((s) => s.deleteVault);
  const lock = useVault((s) => s.lock);
  const auth = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function handleChangePassword() {
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg({
        ok: false,
        text: "New password must be at least 8 characters.",
      });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    setBusy(true);
    try {
      await changeMasterPassword(current, next);
      setPwMsg({ ok: true, text: "Master password updated." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setPwMsg({
        ok: false,
        text: errorMessage(err, "Could not change password."),
      });
    } finally {
      setBusy(false);
    }
  }

  function handleExport() {
    const file = exportVault();
    if (!file) return;
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jackpass-backup-${new Date().toISOString().slice(0, 10)}.enc.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    setImportMsg(null);
    try {
      const text = await file.text();
      await importVault(JSON.parse(text));
      setImportMsg(
        "Encrypted backup imported. Unlock with that vault's master password.",
      );
    } catch (err) {
      setImportMsg(errorMessage(err, "Invalid backup file."));
    }
  }

  async function handleDeleteVault() {
    setDeleteMsg(null);
    if (deletePassword.length === 0) {
      setDeleteMsg({
        ok: false,
        text: "Enter your master password to confirm.",
      });
      return;
    }
    setDeleteBusy(true);
    try {
      await deleteVault(deletePassword);
      setDeletePassword("");
    } catch (err) {
      setDeleteMsg({
        ok: false,
        text: errorMessage(err, "Could not delete vault."),
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[640px] flex-col gap-[24px] p-[24px]">
      <h1 className="text-[24px] font-normal tracking-[-0.4px] text-ink">
        Settings
      </h1>

      <Card>
        <h2 className="mb-[16px] text-[18px] font-semibold text-ink">
          Security
        </h2>
        <div className="flex flex-col gap-[20px]">
          <div>
            <p className="mb-[8px] text-[14px] font-semibold text-body-strong">
              Auto-lock after inactivity
            </p>
            <div className="flex flex-wrap gap-[8px]">
              {lockOptions.map((o) => (
                <Chip
                  key={o.ms}
                  active={settings.autoLockMs === o.ms}
                  onClick={() => settings.setAutoLockMs(o.ms)}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
          <p className="text-[13px] text-muted">
            Key derivation:{" "}
            <span className="font-semibold">
              {settings.kdf === "argon2id" ? "Argon2id" : "PBKDF2 (fallback)"}
            </span>
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="mb-[16px] text-[18px] font-semibold text-ink">
          Change master password
        </h2>
        <form
          className="flex flex-col gap-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleChangePassword();
          }}
        >
          <Field label="Current password" htmlFor="cur">
            <PasswordField
              id="cur"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="New password" htmlFor="newpw">
            <PasswordField
              id="newpw"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="cfm">
            <PasswordField
              id="cfm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {pwMsg && (
            <p
              className={`text-[13px] ${pwMsg.ok ? "text-semantic-up" : "text-semantic-down"}`}
            >
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-[16px] text-[18px] font-semibold text-ink">
          Encrypted backup
        </h2>
        <p className="mb-[16px] text-[14px] text-body">
          Export or import the encrypted vault file. Backups stay encrypted and
          require the master password to open.
        </p>
        <div className="flex flex-wrap gap-[12px]">
          <Button variant="outline" onClick={handleExport}>
            Export backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />
        </div>
        {importMsg && (
          <p className="mt-[12px] text-[13px] text-body">{importMsg}</p>
        )}
      </Card>

      <Card>
        <h2 className="mb-[16px] text-[18px] font-semibold text-ink">
          Delete vault
        </h2>
        <p className="mb-[16px] text-[14px] text-body">
          Permanently remove this account&apos;s vault from this device and
          Google Drive. Your credentials cannot be recovered afterward. A local
          encrypted archive is kept on this device before deletion.
        </p>
        <form
          className="flex flex-col gap-[12px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleDeleteVault();
          }}
        >
          <Field label="Master password" htmlFor="delete-mp">
            <PasswordField
              id="delete-mp"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </Field>
          {deleteMsg && (
            <p
              className={`text-[13px] ${deleteMsg.ok ? "text-semantic-up" : "text-semantic-down"}`}
            >
              {deleteMsg.text}
            </p>
          )}
          <Button
            type="submit"
            variant="danger"
            disabled={deleteBusy || deletePassword.length === 0}
          >
            {deleteBusy ? "Deleting…" : "Delete vault"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-[16px] text-[18px] font-semibold text-ink">
          Account
        </h2>
        {auth.signedIn && auth.accountEmail && (
          <p className="mb-[12px] text-[13px] text-body">
            Google: {auth.accountEmail}
          </p>
        )}
        <div className="flex flex-wrap gap-[12px]">
          <Button variant="outline" onClick={lock}>
            Lock vault
          </Button>
          {auth.configured && auth.signedIn && (
            <Button
              variant="outline"
              onClick={() => {
                void (async () => {
                  await auth.signOut();
                  lock();
                })();
              }}
            >
              Sign out
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[100px] px-[14px] py-[8px] text-[13px] font-semibold ${
        active
          ? "bg-primary text-on-primary"
          : "bg-surface-strong text-ink hover:bg-hairline"
      }`}
    >
      {children}
    </button>
  );
}
