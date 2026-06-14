import { AppError } from "@/lib/errors";

export interface GoogleAccount {
  sub: string;
  email: string;
}

/** Resolve the signed-in Google account from a Drive access token. */
export async function resolveGoogleAccount(
  accessToken: string,
): Promise<GoogleAccount> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new AppError(
      "DRIVE_AUTH",
      "Could not resolve Google account. Sign in again.",
    );
  }
  const data = (await res.json()) as { sub?: string; email?: string };
  if (!data.sub || !data.email) {
    throw new AppError("DRIVE_AUTH", "Google account info was incomplete.");
  }
  return { sub: data.sub, email: data.email };
}
