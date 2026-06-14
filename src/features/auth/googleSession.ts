// Short-lived Google OAuth session cache for the current browser tab.

import type { AccessToken } from "@/storage/drive/gis";

const SESSION_KEY = "jackpass_google_session";

export interface CachedGoogleSession {
  accountKey: string;
  accountId: string;
  accountEmail: string;
  token: AccessToken;
}

export function readCachedGoogleSession(): CachedGoogleSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedGoogleSession;
    if (!parsed.token?.token || parsed.token.expiresAt <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!parsed.accountKey || !parsed.accountId || !parsed.accountEmail) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function writeCachedGoogleSession(session: CachedGoogleSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearCachedGoogleSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
