import { useState } from "react";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { useVault } from "@/features/vault/vaultStore";
import { copyToClipboard } from "@/lib/clipboard";

export function RecoveryKeyScreen() {
  const recoveryKey = useVault((s) => s.pendingRecoveryKey);
  const acknowledge = useVault((s) => s.acknowledgeRecoveryKey);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!recoveryKey) return null;

  async function copy() {
    await copyToClipboard(recoveryKey!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob(
      [
        `JackPass recovery key\nGenerated: ${new Date().toISOString()}\n\n${recoveryKey}\n\n` +
          `Keep this secret and safe. It is the ONLY way to recover your vault if you forget your master password.`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jackpass-recovery-key.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center gap-[24px] px-[24px] py-[48px]">
      <div>
        <h1 className="text-[28px] font-normal tracking-[-0.5px] text-ink">Save your recovery key</h1>
        <p className="mt-[8px] text-[15px] text-body">
          This key is shown only once. If you forget your master password, this is the only way to
          regain access. Store it somewhere safe and offline.
        </p>
      </div>

      <Card className="bg-surface-dark text-on-dark" pad>
        <p className="tabular select-all break-words text-center text-[22px] tracking-[2px] text-on-dark">
          {recoveryKey}
        </p>
      </Card>

      <div className="flex gap-[12px]">
        <Button variant="outline" block onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" block onClick={download}>
          Download
        </Button>
      </div>

      <label className="flex items-start gap-[10px] text-[14px] text-body">
        <input
          type="checkbox"
          className="mt-[2px] h-[18px] w-[18px] accent-primary"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        <span>I have saved my recovery key in a safe place.</span>
      </label>

      <Button size="lg" block disabled={!saved} onClick={acknowledge}>
        Continue to my vault
      </Button>
    </div>
  );
}
