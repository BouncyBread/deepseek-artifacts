import { describe, it, expect } from "vitest";

function validatePassphrase(input: string, expected: string): boolean {
  if (!input || !expected) return false;
  return input === expected;
}

describe("auth", () => {
  it("accepts correct passphrase", () => {
    expect(validatePassphrase("secret123", "secret123")).toBe(true);
  });

  it("rejects wrong passphrase", () => {
    expect(validatePassphrase("wrong", "secret123")).toBe(false);
  });

  it("rejects empty passphrase", () => {
    expect(validatePassphrase("", "secret123")).toBe(false);
  });

  it("rejects empty expected passphrase", () => {
    expect(validatePassphrase("anything", "")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(validatePassphrase("Secret123", "secret123")).toBe(false);
  });
});
