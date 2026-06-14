import { describe, expect, it } from "vitest";
import {
  createVault,
  setMasterPassword,
  unlockVault,
} from "@/vault/vault";
import { AppError } from "@/lib/errors";

describe("vault crypto lifecycle", () => {
  it("creates and unlocks a vault with the master password", async () => {
    const created = await createVault("correct horse battery staple", "pbkdf2-sha256");

    const unlocked = await unlockVault(created.file, "correct horse battery staple");

    expect(unlocked.data.version).toBe(1);
    expect(unlocked.data.items).toEqual([]);
    expect(created.file.body.ct).not.toContain("correct horse battery staple");
  });

  it("rejects an incorrect master password without decrypting", async () => {
    const created = await createVault("valid password", "pbkdf2-sha256");

    await expect(unlockVault(created.file, "wrong password")).rejects.toMatchObject({
      code: "WRONG_SECRET",
    } satisfies Partial<AppError>);
  });

  it("recovers with recovery key and rewraps the master-password envelope", async () => {
    const created = await createVault("old password", "pbkdf2-sha256");
    const recovered = await unlockVault(created.file, created.recoveryKey, "recoveryKey");
    const rewrapped = await setMasterPassword(recovered, "new password", "pbkdf2-sha256");

    await expect(unlockVault(rewrapped.file, "old password")).rejects.toMatchObject({
      code: "WRONG_SECRET",
    } satisfies Partial<AppError>);

    const unlocked = await unlockVault(rewrapped.file, "new password");
    expect(unlocked.data.items).toHaveLength(0);
  });
});
