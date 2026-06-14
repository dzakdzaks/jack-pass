import { isAppError } from "./errors";

export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (isAppError(err)) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
