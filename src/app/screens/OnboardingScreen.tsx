import { useState } from "react";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { PasswordField } from "@/ui/PasswordField";
import { BrandMark } from "@/ui/BrandMark";
import { useAuth } from "@/features/auth/authStore";
import { useVault } from "@/features/vault/vaultStore";
import { errorMessage } from "@/lib/errorMessage";

type Step = "welcome" | "create";

export function OnboardingScreen() {
  const configured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => s.signedIn);
  const accountEmail = useAuth((s) => s.accountEmail);
  const signOut = useAuth((s) => s.signOut);
  const createNewVault = useVault((s) => s.createNewVault);

  const [step, setStep] = useState<Step>(
    configured && signedIn ? "create" : "welcome",
  );
  const [busy, setBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function handleCreate() {
    setError(null);
    if (password.length < 8) {
      setError("Master password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!accepted) {
      setError("Please acknowledge the recovery warning.");
      return;
    }
    setBusy(true);
    try {
      await createNewVault(password);
    } catch (err) {
      setError(errorMessage(err, "Could not create vault."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleAccount() {
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-[32px] px-[24px] py-[48px]">
      <div className="flex flex-col items-center gap-[16px] text-center">
        <BrandMark size={56} />
        <div>
          <h1 className="text-[36px] font-normal tracking-[-0.5px] text-ink">
            {step === "create" && configured ? "Create your vault" : "JackPass"}
          </h1>
          <p className="mt-[8px] text-[16px] text-body">
            {step === "create" && configured ? (
              <>
                No vault exists for {accountEmail} yet. Choose a master password
                to encrypt this account&apos;s vault.
              </>
            ) : (
              <>
                A private, end-to-end encrypted password manager. Your vault is
                encrypted on this device before it is stored anywhere.
              </>
            )}
          </p>
        </div>
      </div>

      {step === "welcome" && !configured && (
        <div className="flex flex-col gap-[12px]">
          <Button size="lg" block onClick={() => setStep("create")}>
            Create a vault
          </Button>
          <p className="text-center text-[13px] text-muted">
            Google Drive sync is not configured. You can create a local
            encrypted vault.
          </p>
        </div>
      )}

      {step === "create" && (
        <form
          className="flex flex-col gap-[16px]"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
        >
          <Field
            label="Master password"
            htmlFor="mp"
            hint="Choose something strong and memorable. It is never sent anywhere."
          >
            <PasswordField
              id="mp"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Confirm master password" htmlFor="mpc">
            <PasswordField
              id="mpc"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>

          <label className="flex items-start gap-[10px] rounded-[12px] bg-surface-soft p-[16px] text-[13px] text-body">
            <input
              type="checkbox"
              className="mt-[2px] h-[18px] w-[18px] accent-primary"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span>
              I understand that if I lose both my master password and my
              recovery key, my vault data cannot be recovered by anyone.
            </span>
          </label>

          {error && <p className="text-[13px] text-semantic-down">{error}</p>}

          <Button size="lg" block type="submit" disabled={busy || authBusy}>
            {busy ? "Creating vault…" : "Create vault"}
          </Button>
          {configured && signedIn && (
            <Button
              variant="ghost"
              block
              onClick={() => void handleGoogleAccount()}
              disabled={busy || authBusy}
            >
              {authBusy ? "Signing out…" : "Sign out"}
            </Button>
          )}
          {!configured && (
            <Button
              variant="ghost"
              block
              onClick={() => setStep("welcome")}
              disabled={busy}
            >
              Back
            </Button>
          )}
        </form>
      )}
    </div>
  );
}
