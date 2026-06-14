// Non-sensitive user preferences. Persisted in localStorage (no vault data here).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  /** Auto-lock after this many ms of inactivity. */
  autoLockMs: number;
  /** Lock after the tab has been hidden this many ms. */
  lockOnHiddenMs: number;
  /** Preferred KDF; pbkdf2 is a temporary fallback (PRD 8). */
  kdf: "argon2id" | "pbkdf2-sha256";
  setAutoLockMs: (ms: number) => void;
  setLockOnHiddenMs: (ms: number) => void;
  setKdf: (kdf: "argon2id" | "pbkdf2-sha256") => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      autoLockMs: 5 * 60_000,
      lockOnHiddenMs: 60_000,
      kdf: "argon2id",
      setAutoLockMs: (autoLockMs) => set({ autoLockMs }),
      setLockOnHiddenMs: (lockOnHiddenMs) => set({ lockOnHiddenMs }),
      setKdf: (kdf) => set({ kdf }),
    }),
    { name: "jackpass-settings" },
  ),
);
