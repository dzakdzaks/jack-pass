import { useState } from "react";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { Input } from "@/ui/Input";
import { PasswordField } from "@/ui/PasswordField";
import { useVault } from "@/features/vault/vaultStore";
import { normalizeRecoveryKey } from "@/crypto/recoveryKey";
import { errorMessage } from "@/lib/errorMessage";

interface Props {
  onCancel: () => void;
}

type Mode = "choose" | "recovery" | "reset";

const RESET_PHRASE = "RESET MY VAULT";

export function ForgotPasswordFlow({ onCancel }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const recoverWithKey = useVault((s) => s.recoverWithKey);
  const resetVault = useVault((s) => s.resetVault);
  const dirty = useVault((s) => s.syncMeta.dirty);

  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validatePasswords(): boolean {
    if (newPassword.length < 8) {
      setError("New master password must be at least 8 characters.");
      return false;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  }

  async function handleRecover() {
    setError(null);
    if (!validatePasswords()) return;
    setBusy(true);
    try {
      await recoverWithKey(normalizeRecoveryKey(recoveryKey), newPassword);
    } catch (err) {
      setError(errorMessage(err, "Invalid recovery key."));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setError(null);
    if (phrase !== RESET_PHRASE) {
      setError(`Type "${RESET_PHRASE}" exactly to confirm.`);
      return;
    }
    if (!validatePasswords()) return;
    setBusy(true);
    try {
      await resetVault(newPassword);
    } catch (err) {
      setError(errorMessage(err, "Could not reset vault."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-[24px] px-[24px] py-[48px]">
      <h1 className="text-[26px] font-normal tracking-[-0.5px] text-ink">Forgot master password</h1>

      {mode === "choose" && (
        <div className="flex flex-col gap-[16px]">
          <p className="text-[15px] text-body">
            Signing in with Google alone cannot unlock your vault. Your data is encrypted with your
            master password or recovery key.
          </p>
          <Button size="lg" block onClick={() => setMode("recovery")}>
            I have my recovery key
          </Button>
          <Button variant="danger" size="lg" block onClick={() => setMode("reset")}>
            Reset vault (delete access to data)
          </Button>
          <Button variant="ghost" block onClick={onCancel}>
            Back to unlock
          </Button>
        </div>
      )}

      {mode === "recovery" && (
        <form
          className="flex flex-col gap-[16px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleRecover();
          }}
        >
          <Field label="Recovery key" htmlFor="rk" hint="Enter the key you saved during setup.">
            <Input
              id="rk"
              autoFocus
              autoComplete="off"
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value)}
              placeholder="XXXXX-XXXXX-…"
            />
          </Field>
          <Field label="New master password" htmlFor="np">
            <PasswordField id="np" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new master password" htmlFor="npc" error={error ?? undefined}>
            <PasswordField id="npc" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button size="lg" block type="submit" disabled={busy}>
            {busy ? "Recovering…" : "Recover and set new password"}
          </Button>
          <Button variant="ghost" block onClick={() => setMode("choose")} disabled={busy}>
            Back
          </Button>
        </form>
      )}

      {mode === "reset" && (
        <form
          className="flex flex-col gap-[16px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleReset();
          }}
        >
          <div className="rounded-[12px] border border-semantic-down/40 bg-semantic-down/5 p-[16px] text-[14px] text-semantic-down">
            Resetting creates a new empty vault. Your existing credentials remain encrypted and will
            be <strong>permanently inaccessible</strong> without the old master password or recovery
            key. The old encrypted vault is archived, not decrypted.
          </div>
          {dirty && (
            <p className="text-[13px] text-semantic-down">
              You have unsynced local changes. Resetting will discard access to them.
            </p>
          )}
          <Field label={`Type "${RESET_PHRASE}" to confirm`} htmlFor="phrase">
            <Input id="phrase" autoComplete="off" value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </Field>
          <Field label="New master password" htmlFor="rnp">
            <PasswordField id="rnp" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new master password" htmlFor="rnpc" error={error ?? undefined}>
            <PasswordField id="rnpc" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button variant="danger" size="lg" block type="submit" disabled={busy}>
            {busy ? "Resetting…" : "Reset vault"}
          </Button>
          <Button variant="ghost" block onClick={() => setMode("choose")} disabled={busy}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
