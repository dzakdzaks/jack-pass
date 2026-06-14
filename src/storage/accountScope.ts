// Namespaces local vault data per Google account (or "local" without Google).

export const LOCAL_ACCOUNT_KEY = "local";

const ACTIVE_ACCOUNT_KEY = "jackpass_active_account";

export function googleAccountKey(sub: string): string {
  return `google:${sub}`;
}

export function getActiveAccountKey(): string {
  if (typeof sessionStorage === "undefined") return LOCAL_ACCOUNT_KEY;
  return sessionStorage.getItem(ACTIVE_ACCOUNT_KEY) ?? LOCAL_ACCOUNT_KEY;
}

export function setActiveAccountKey(key: string): void {
  sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, key);
}

export function isGoogleAccountKey(key: string): boolean {
  return key.startsWith("google:");
}
