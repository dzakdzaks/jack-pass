// HTTP security headers for production static hosting (nginx / Caddy / Vite preview).
// Keep Content-Security-Policy in sync with security/csp.ts.

import { buildCsp } from "./csp";

export interface SecurityHeaderMap {
  [name: string]: string;
}

/** Headers safe to send from a static file server in front of JackPass. */
export function productionSecurityHeaders(): SecurityHeaderMap {
  return {
    "Content-Security-Policy": buildCsp(true),
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
}
