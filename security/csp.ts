// Content Security Policy (PRD §8 / IMPLEMENTATION-PLAN M5).
// Google Identity Services + Drive REST require the gstatic/googleapis origins.
// 'wasm-unsafe-eval' is required for Argon2 WebAssembly key derivation.

const BASE_DIRECTIVES: string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com",
  "frame-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

/** CSP string for dev and production builds. */
export function buildCsp(isProduction: boolean): string {
  const directives = [...BASE_DIRECTIVES];
  if (isProduction) {
    // Upgrade any accidental HTTP subresources when served behind HTTPS (VPS / TLS).
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}
