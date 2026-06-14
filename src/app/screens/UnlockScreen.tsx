import { useState } from "react";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { PasswordField } from "@/ui/PasswordField";
import { BrandMark } from "@/ui/BrandMark";
import { useAuth } from "@/features/auth/authStore";
import { useVault } from "@/features/vault/vaultStore";
import { errorMessage } from "@/lib/errorMessage";
import { ForgotPasswordFlow } from "@/features/recovery/ForgotPasswordFlow";

export function UnlockScreen() {
  const unlock = useVault((s) => s.unlock);
  const syncError = useVault((s) => s.syncError);
  const accountEmail = useAuth((s) => s.accountEmail);
  const configured = useAuth((s) => s.configured);
  const signOut = useAuth((s) => s.signOut);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function handleSignOut() {
    setAuthBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(errorMessage(err, "Could not sign out."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    try {
      await unlock(password);
    } catch (err) {
      setError(errorMessage(err, "Incorrect master password."));
    } finally {
      setBusy(false);
    }
  }

  if (forgot) return <ForgotPasswordFlow onCancel={() => setForgot(false)} />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-[24px] px-[24px] py-[48px]">
      <div className="flex flex-col items-center gap-[12px] text-center">
        <BrandMark size={48} />
        <h1 className="text-[28px] font-normal tracking-[-0.5px] text-ink">
          Unlock your vault
        </h1>
        {configured && accountEmail && (
          <p className="text-[14px] text-body">Signed in as {accountEmail}</p>
        )}
      </div>

      <form
        className="flex flex-col gap-[16px]"
        onSubmit={(e) => {
          e.preventDefault();
          void handleUnlock();
        }}
      >
        <Field
          label="Master password"
          htmlFor="unlock-mp"
          error={error ?? undefined}
        >
          <PasswordField
            id="unlock-mp"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button
          size="lg"
          block
          type="submit"
          disabled={busy || password.length === 0}
        >
          {busy ? "Unlocking…" : "Unlock"}
        </Button>
      </form>

      {configured && (
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={authBusy}
          className="mx-auto text-[13px] font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {authBusy ? "Signing out…" : "Sign out"}
        </button>
      )}

      {syncError && (
        <p className="rounded-[12px] bg-semantic-down/5 p-[12px] text-[13px] text-semantic-down">
          {syncError}
        </p>
      )}

      <button
        type="button"
        onClick={() => setForgot(true)}
        className="mx-auto text-[14px] font-semibold text-primary hover:underline"
      >
        Forgot master password?
      </button>
    </div>
  );
}
