// Google auth/token state. Each Google account has its own vault namespace.

import { create } from "zustand";
import {
  isConfigured,
  requestAccessToken,
  revokeToken,
  type AccessToken,
} from "@/storage/drive/gis";
import { setGoogleLinked } from "@/storage/idb/db";
import { AppError } from "@/lib/errors";
import { resolveGoogleAccount } from "@/features/auth/googleAccount";
import {
  clearCachedGoogleSession,
  readCachedGoogleSession,
  writeCachedGoogleSession,
} from "@/features/auth/googleSession";
import {
  getActiveAccountKey,
  googleAccountKey,
  LOCAL_ACCOUNT_KEY,
  setActiveAccountKey,
} from "@/storage/accountScope";

interface AuthState {
  token: AccessToken | null;
  signedIn: boolean;
  configured: boolean;
  accountId: string | null;
  accountEmail: string | null;
  accountKey: string | null;
  sessionChecked: boolean;
  error: string | null;
  signIn: () => Promise<string>;
  /** Restore a cached Google session from this tab only (never opens a prompt). */
  restoreCachedSession: () => Promise<boolean>;
  ensureToken: () => Promise<string>;
  signOut: () => Promise<void>;
}

type AuthSet = (
  partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>),
) => void;

async function switchVaultAccount(accountKey: string): Promise<void> {
  const { useVault } = await import("@/features/vault/vaultStore");
  await useVault.getState().switchAccount(accountKey);
}

async function adoptGoogleSession(
  token: AccessToken,
  account: { sub: string; email: string },
  set: AuthSet,
): Promise<string> {
  const accountKey = googleAccountKey(account.sub);
  const previousKey = getActiveAccountKey();

  setActiveAccountKey(accountKey);
  writeCachedGoogleSession({
    accountKey,
    accountId: account.sub,
    accountEmail: account.email,
    token,
  });

  if (previousKey !== accountKey) {
    await switchVaultAccount(accountKey);
  }

  await setGoogleLinked(true, accountKey);

  set({
    token,
    signedIn: true,
    accountId: account.sub,
    accountEmail: account.email,
    accountKey,
    sessionChecked: true,
    error: null,
  });

  return token.token;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: null,
  signedIn: false,
  configured: isConfigured(),
  accountId: null,
  accountEmail: null,
  accountKey: null,
  sessionChecked: false,
  error: null,

  signIn: async () => {
    try {
      const token = await requestAccessToken("select_account");
      const account = await resolveGoogleAccount(token.token);
      return await adoptGoogleSession(token, account, set);
    } catch (err) {
      const message = err instanceof AppError ? err.message : "Sign-in failed.";
      set({ error: message, sessionChecked: true });
      throw err;
    }
  },

  restoreCachedSession: async () => {
    if (!isConfigured()) {
      set({ sessionChecked: true });
      return false;
    }

    const cached = readCachedGoogleSession();
    if (!cached) {
      set({ sessionChecked: true });
      return false;
    }

    setActiveAccountKey(cached.accountKey);
    await switchVaultAccount(cached.accountKey);
    set({
      token: cached.token,
      signedIn: true,
      accountId: cached.accountId,
      accountEmail: cached.accountEmail,
      accountKey: cached.accountKey,
      sessionChecked: true,
      error: null,
    });
    return true;
  },

  ensureToken: async () => {
    const current = get().token;
    if (current && current.expiresAt > Date.now()) return current.token;

    const cached = readCachedGoogleSession();
    if (cached && cached.token.expiresAt > Date.now()) {
      setActiveAccountKey(cached.accountKey);
      set({
        token: cached.token,
        signedIn: true,
        accountId: cached.accountId,
        accountEmail: cached.accountEmail,
        accountKey: cached.accountKey,
        error: null,
      });
      return cached.token.token;
    }

    const token = await requestAccessToken("");
    const account = await resolveGoogleAccount(token.token);
    return await adoptGoogleSession(token, account, set);
  },

  signOut: async () => {
    const current = get().token;
    const accountKey = get().accountKey;
    if (current) revokeToken(current.token);
    clearCachedGoogleSession();
    if (accountKey) await setGoogleLinked(false, accountKey);
    set({
      token: null,
      signedIn: false,
      accountId: null,
      accountEmail: null,
      accountKey: null,
      sessionChecked: true,
    });
    setActiveAccountKey(LOCAL_ACCOUNT_KEY);
    await switchVaultAccount(LOCAL_ACCOUNT_KEY);
  },
}));
