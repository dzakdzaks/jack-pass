// High-entropy recovery key generation + formatting (PRD 8 "Recovery Key").
// Shown once at setup, never stored in plaintext.

import { randomBytes } from "./random";

// Crockford base32 alphabet (no I, L, O, U) for human transcription safety.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 6;
const CHARS_PER_GROUP = 5; // 30 chars => ~150 bits of entropy.

/** Generate a grouped recovery key like "A1B2C-D3E4F-...". */
export function generateRecoveryKey(): string {
  const total = GROUPS * CHARS_PER_GROUP;
  const bytes = randomBytes(total);
  let out = "";
  for (let i = 0; i < total; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
    const atGroupEnd = (i + 1) % CHARS_PER_GROUP === 0;
    if (atGroupEnd && i !== total - 1) out += "-";
  }
  bytes.fill(0);
  return out;
}

/** Normalize user-entered recovery keys: uppercase, strip separators/whitespace. */
export function normalizeRecoveryKey(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
