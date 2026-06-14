// Google Identity Services (token model) wrapper. Requests a short-lived OAuth
// access token for the narrow drive.appdata scope from a user gesture (PRD 16).

import { AppError } from "@/lib/errors";

const GIS_SRC = "https://accounts.google.com/gsi/client";
export const DRIVE_APPDATA_SCOPE =
  "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email";

export type TokenPrompt = "" | "consent" | "select_account";

// Public OAuth client id. Safe to expose in a browser app (PRD 16); security
// relies on authorized-origin restrictions + least-privilege scope.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    prompt?: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string; message?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new AppError("DRIVE_AUTH", "Failed to load Google Identity Services.")));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new AppError("DRIVE_AUTH", "Failed to load Google Identity Services."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface AccessToken {
  token: string;
  /** epoch ms when the token expires. */
  expiresAt: number;
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID);
}

/**
 * Request an access token. Must be invoked from a user gesture. `prompt` is ""
 * for silent refresh attempts and "consent" for the first authorization.
 */
export async function requestAccessToken(
  prompt: TokenPrompt = "",
): Promise<AccessToken> {
  if (!CLIENT_ID) {
    throw new AppError(
      "DRIVE_AUTH",
      "Missing VITE_GOOGLE_CLIENT_ID. Set it in .env.local to enable Google Drive sync.",
    );
  }
  await loadGisScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new AppError("DRIVE_AUTH", "Google Identity Services unavailable.");

  return new Promise<AccessToken>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_APPDATA_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new AppError("DRIVE_AUTH", resp.error_description ?? resp.error ?? "Authorization failed."));
          return;
        }
        resolve({
          token: resp.access_token,
          expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 - 30_000,
        });
      },
      error_callback: (err) => {
        reject(new AppError("DRIVE_AUTH", err.message ?? "Authorization was cancelled."));
      },
    });
    client.requestAccessToken({ prompt });
  });
}

export function revokeToken(token: string): void {
  window.google?.accounts?.oauth2?.revoke(token);
}
