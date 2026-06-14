// Wires browser lifecycle into the vault store: auto-lock on inactivity, lock
// when the tab is hidden too long, and online/offline sync triggers (PRD 8, 11).

import { useEffect } from "react";
import { useVault } from "./vaultStore";
import { useSettings } from "@/features/settings/settingsStore";

export function useAppLifecycle(): void {
  const phase = useVault((s) => s.phase);
  const lock = useVault((s) => s.lock);
  const setOnline = useVault((s) => s.setOnline);
  const autoLockMs = useSettings((s) => s.autoLockMs);
  const lockOnHiddenMs = useSettings((s) => s.lockOnHiddenMs);

  // Online / offline.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setOnline]);

  // Inactivity auto-lock (only while unlocked).
  useEffect(() => {
    if (phase !== "unlocked") return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => lock(), autoLockMs);
    };
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "scroll"];
    events.forEach((e) => document.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, [phase, autoLockMs, lock]);

  // Lock after the tab has been hidden for the configured duration.
  useEffect(() => {
    if (phase !== "unlocked") return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenTimer = setTimeout(() => lock(), lockOnHiddenMs);
      } else if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [phase, lockOnHiddenMs, lock]);
}
