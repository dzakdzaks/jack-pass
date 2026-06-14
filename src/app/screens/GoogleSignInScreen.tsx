import { useState } from "react";
import { Button } from "@/ui/Button";
import { BrandMark } from "@/ui/BrandMark";
import { useAuth } from "@/features/auth/authStore";
import { useVault } from "@/features/vault/vaultStore";
import { errorMessage } from "@/lib/errorMessage";

/** Entry screen when Google sync is configured — sign-in is always user-initiated. */
export function GoogleSignInScreen() {
  const signIn = useAuth((s) => s.signIn);
  const syncNow = useVault((s) => s.syncNow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signIn();
      await syncNow();
    } catch (err) {
      setError(errorMessage(err, "Google sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center gap-[32px] px-[24px] py-[48px]">
      <div className="flex flex-col items-center gap-[16px] text-center">
        <BrandMark size={56} />
        <div>
          <h1 className="text-[36px] font-normal tracking-[-0.5px] text-ink">JackPass</h1>
          <p className="mt-[8px] text-[16px] text-body">
            Sign in with Google to open your encrypted vault. Each Google account
            has its own master password and data.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        <Button size="lg" block onClick={() => void handleGoogle()} disabled={busy}>
          {busy ? "Connecting…" : "Continue with Google"}
        </Button>
        {error && <p className="text-center text-[13px] text-semantic-down">{error}</p>}
      </div>
    </div>
  );
}
