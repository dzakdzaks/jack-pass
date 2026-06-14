// Typed application errors so the UI can react without leaking secrets.

export type AppErrorCode =
  | "WRONG_SECRET"
  | "NO_VAULT"
  | "VAULT_CORRUPT"
  | "VAULT_INCOMPATIBLE"
  | "DRIVE_AUTH"
  | "DRIVE_QUOTA"
  | "DRIVE_CONFLICT"
  | "DRIVE_NOT_FOUND"
  | "OFFLINE"
  | "UNKNOWN";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
