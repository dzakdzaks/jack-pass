// All randomness flows through crypto.getRandomValues (PRD 8).

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomId(): string {
  return crypto.randomUUID();
}
