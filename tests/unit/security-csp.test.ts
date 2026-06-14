import { describe, expect, it } from "vitest";
import { buildCsp } from "../../security/csp";
import { productionSecurityHeaders } from "../../security/headers";

describe("buildCsp", () => {
  it("allows only required Google and self origins", () => {
    const csp = buildCsp(false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("https://accounts.google.com");
    expect(csp).toContain("https://www.googleapis.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("upgrades insecure requests in production", () => {
    const csp = buildCsp(true);
    expect(csp).toContain("upgrade-insecure-requests");
  });
});

describe("productionSecurityHeaders", () => {
  it("includes HSTS and CSP for static hosting", () => {
    const headers = productionSecurityHeaders();
    expect(headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(headers["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });
});
