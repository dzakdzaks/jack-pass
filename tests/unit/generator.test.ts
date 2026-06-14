import { describe, expect, it } from "vitest";
import {
  estimateStrength,
  generatePassword,
  type GeneratorOptions,
} from "@/features/generator/generator";

describe("password generator", () => {
  it("honors length and enabled character classes", () => {
    const opts: GeneratorOptions = {
      length: 32,
      uppercase: false,
      lowercase: true,
      numbers: true,
      symbols: false,
      avoidAmbiguous: true,
    };

    const password = generatePassword(opts);

    expect(password).toHaveLength(32);
    expect(password).toMatch(/^[a-z2-9ABCDEFGHJKMNPQRSTVWXYZ]*$/i);
    expect(password).not.toMatch(/[!@#$%^&*()]/);
  });

  it("estimates stronger generated passwords as strong", () => {
    const opts: GeneratorOptions = {
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      avoidAmbiguous: true,
    };

    const password = generatePassword(opts);
    const strength = estimateStrength(password, opts);

    expect(strength.bits).toBeGreaterThanOrEqual(120);
    expect(strength.label).toBe("Strong");
  });
});
