import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useVault } from "@/features/vault/vaultStore";
import { useAuth } from "@/features/auth/authStore";
import { useAppLifecycle } from "@/features/vault/useAppLifecycle";
import { GoogleSignInScreen } from "./screens/GoogleSignInScreen";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { UnlockScreen } from "./screens/UnlockScreen";
import { RecoveryKeyScreen } from "./screens/RecoveryKeyScreen";
import { ConflictModal } from "@/features/sync/ConflictModal";
import { BrandMark } from "@/ui/BrandMark";

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <BrandMark size={56} className="animate-pulse" />
    </div>
  );
}

export function App() {
  const phase = useVault((s) => s.phase);
  const pendingRecoveryKey = useVault((s) => s.pendingRecoveryKey);
  const bootstrap = useVault((s) => s.bootstrap);
  const configured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => s.signedIn);
  const sessionChecked = useAuth((s) => s.sessionChecked);
  useAppLifecycle();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (pendingRecoveryKey) return <RecoveryKeyScreen />;

  if (phase === "booting" || !sessionChecked) return <Splash />;

  if (configured && !signedIn) return <GoogleSignInScreen />;

  if (phase === "no-vault") return <OnboardingScreen />;
  if (phase === "locked") return <UnlockScreen />;

  return (
    <>
      <RouterProvider router={router} />
      <ConflictModal />
    </>
  );
}
