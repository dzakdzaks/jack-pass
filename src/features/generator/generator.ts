// Password generator + strength estimate (PRD 10 "Password Generator").
// Uses crypto.getRandomValues for unbiased selection.

import { randomBytes } from "@/crypto/random";

export interface GeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};

const SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};

// Characters that are easy to confuse when transcribing.
const AMBIGUOUS = new Set("O0oIl1|`'\";:.,{}[]()/\\".split(""));

function buildPool(opts: GeneratorOptions): string[] {
  let chars = "";
  if (opts.uppercase) chars += SETS.uppercase;
  if (opts.lowercase) chars += SETS.lowercase;
  if (opts.numbers) chars += SETS.numbers;
  if (opts.symbols) chars += SETS.symbols;
  let pool = chars.split("");
  if (opts.avoidAmbiguous) pool = pool.filter((c) => !AMBIGUOUS.has(c));
  return pool;
}

/** Rejection-sampled random index in [0, max) to avoid modulo bias. */
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max;
  for (;;) {
    const byte = randomBytes(1)[0];
    if (byte < limit) return byte % max;
  }
}

export function generatePassword(opts: GeneratorOptions): string {
  const pool = buildPool(opts);
  if (pool.length === 0) return "";
  const length = Math.max(1, Math.min(opts.length, 256));
  let out = "";
  for (let i = 0; i < length; i++) out += pool[randomIndex(pool.length)];
  return out;
}

export interface StrengthResult {
  bits: number;
  label: "Weak" | "Fair" | "Good" | "Strong";
}

/** Rough entropy estimate from charset size and length. */
export function estimateStrength(password: string, opts: GeneratorOptions): StrengthResult {
  const poolSize = buildPool(opts).length || 1;
  const bits = Math.round(password.length * Math.log2(poolSize));
  let label: StrengthResult["label"] = "Weak";
  if (bits >= 120) label = "Strong";
  else if (bits >= 80) label = "Good";
  else if (bits >= 50) label = "Fair";
  return { bits, label };
}
