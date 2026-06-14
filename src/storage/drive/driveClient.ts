// Google Drive REST v3 client scoped to the hidden appDataFolder (PRD 7).
// Stores exactly one vault file plus optional archived copies. Uses fetch with
// the GIS access token; no googleapis SDK.

import { AppError } from "@/lib/errors";
import type { EncryptedVaultFile } from "@/lib/types";

const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const VAULT_FILENAME = "vault.enc.json";

export interface DriveFileRef {
  id: string;
  name: string;
  headRevisionId?: string;
  modifiedTime?: string;
}

export interface RemoteVault {
  ref: DriveFileRef;
  file: EncryptedVaultFile;
}

interface GoogleApiErrorBody {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function readGoogleError(res: Response): Promise<GoogleApiErrorBody | null> {
  try {
    return (await res.json()) as GoogleApiErrorBody;
  } catch {
    return null;
  }
}

function messageForStatus(status: number, body: GoogleApiErrorBody | null): string {
  const apiMessage = body?.error?.message ?? "";
  const reason = body?.error?.errors?.[0]?.reason ?? "";

  if (status === 401) {
    return "Google sign-in expired. Sign in again to sync.";
  }

  if (status === 403) {
    if (
      reason === "accessNotConfigured" ||
      /has not been used|is disabled|Access Not Configured/i.test(apiMessage)
    ) {
      return (
        "Google Drive API is not enabled for your OAuth project. " +
        "Open Google Cloud Console → APIs & Services → Library → enable “Google Drive API”, " +
        "then reload JackPass and sign in again."
      );
    }
    if (reason === "insufficientPermissions" || /insufficient/i.test(apiMessage)) {
      return (
        "This Google account has not granted Drive app data access. " +
        "Sign out and sign in again, then accept the Drive permission."
      );
    }
    return (
      apiMessage ||
      "Google Drive access was denied. Confirm the Drive API is enabled and your account is added as a test user."
    );
  }

  if (status === 404) return "Drive file not found.";
  if (status === 429) return "Google Drive rate limit reached. Try again shortly.";

  return apiMessage || `Drive request failed (${status}).`;
}

async function handleError(res: Response): Promise<never> {
  const body = await readGoogleError(res);
  const message = messageForStatus(res.status, body);

  if (res.status === 401) throw new AppError("DRIVE_AUTH", message);
  if (res.status === 403) throw new AppError("DRIVE_AUTH", message);
  if (res.status === 404) throw new AppError("DRIVE_NOT_FOUND", message);
  if (res.status === 429) throw new AppError("DRIVE_QUOTA", message);

  throw new AppError("UNKNOWN", message);
}

const FIELDS = "id,name,headRevisionId,modifiedTime";

/** Locate the single vault file in appDataFolder, if present. */
export async function findVaultFile(token: string): Promise<DriveFileRef | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${VAULT_FILENAME}' and trashed = false`,
    fields: `files(${FIELDS})`,
    pageSize: "1",
  });
  const res = await fetch(`${FILES_URL}?${params}`, { headers: authHeaders(token) });
  if (!res.ok) return handleError(res);
  const data = (await res.json()) as { files?: DriveFileRef[] };
  return data.files?.[0] ?? null;
}

/** Fetch current metadata (revision) for a known file id. */
export async function getFileRef(token: string, fileId: string): Promise<DriveFileRef> {
  const params = new URLSearchParams({ fields: FIELDS });
  const res = await fetch(`${FILES_URL}/${fileId}?${params}`, { headers: authHeaders(token) });
  if (!res.ok) return handleError(res);
  return (await res.json()) as DriveFileRef;
}

export async function downloadVault(token: string, fileId: string): Promise<EncryptedVaultFile> {
  const res = await fetch(`${FILES_URL}/${fileId}?alt=media`, { headers: authHeaders(token) });
  if (!res.ok) return handleError(res);
  return (await res.json()) as EncryptedVaultFile;
}

/** Create the vault file in appDataFolder (multipart: metadata + content). */
export async function createVaultFile(
  token: string,
  file: EncryptedVaultFile,
): Promise<DriveFileRef> {
  const boundary = `jackpass-${crypto.randomUUID()}`;
  const metadata = { name: VAULT_FILENAME, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${JSON.stringify(file)}\r\n` +
    `--${boundary}--`;

  const params = new URLSearchParams({ uploadType: "multipart", fields: FIELDS });
  const res = await fetch(`${UPLOAD_URL}?${params}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) return handleError(res);
  return (await res.json()) as DriveFileRef;
}

/** Overwrite the vault file content. */
export async function updateVaultFile(
  token: string,
  fileId: string,
  file: EncryptedVaultFile,
): Promise<DriveFileRef> {
  const params = new URLSearchParams({ uploadType: "media", fields: FIELDS });
  const res = await fetch(`${UPLOAD_URL}/${fileId}?${params}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(file),
  });
  if (!res.ok) return handleError(res);
  return (await res.json()) as DriveFileRef;
}

export async function deleteRemoteVault(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${FILES_URL}/${fileId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (res.status === 404) return;
  if (!res.ok) return handleError(res);
}

/** Upload an archived copy (used by vault reset, PRD 8). */
export async function archiveRemoteVault(
  token: string,
  file: EncryptedVaultFile,
): Promise<DriveFileRef> {
  const boundary = `jackpass-${crypto.randomUUID()}`;
  const name = `vault.archived.${Date.now()}.enc.json`;
  const metadata = { name, parents: ["appDataFolder"] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${JSON.stringify(file)}\r\n` +
    `--${boundary}--`;
  const params = new URLSearchParams({ uploadType: "multipart", fields: FIELDS });
  const res = await fetch(`${UPLOAD_URL}?${params}`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) return handleError(res);
  return (await res.json()) as DriveFileRef;
}
