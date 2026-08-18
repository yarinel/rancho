import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";
import { hashPassword, verifyPassword } from "./password";

describe("staff session tokens", () => {
  it("round-trips a valid token", () => {
    const token = createSessionToken("user-1");
    expect(verifySessionToken(token)?.userId).toBe("user-1");
  });

  it("rejects tampered, malformed, and expired tokens", () => {
    const token = createSessionToken("user-1");
    expect(verifySessionToken(token.replace("user-1", "user-2"))).toBeNull();
    expect(verifySessionToken(token.slice(0, -2) + "ff")).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
    const expired = createSessionToken("user-1", Date.now() - 1000 * 60 * 60 * 24 * 30);
    expect(verifySessionToken(expired)).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies correct passwords and rejects wrong ones", () => {
    const hash = hashPassword("s3cret");
    expect(verifyPassword("s3cret", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
    expect(verifyPassword("s3cret", "malformed")).toBe(false);
  });
});
