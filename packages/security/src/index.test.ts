import { constantTimeEqual, generateOpaqueToken, hashPassword, hashToken, verifyPassword } from "./index";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("never stores the password in plaintext", async () => {
    const hash = await hashPassword("my-secret-password");
    expect(hash).not.toContain("my-secret-password");
  });
});

describe("opaque tokens", () => {
  it("produces a token whose hash matches hashToken() independently", () => {
    const { token, hash } = generateOpaqueToken();
    expect(hashToken(token)).toBe(hash);
  });

  it("produces different tokens on each call", () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(constantTimeEqual("short", "a-lot-longer")).toBe(false);
  });
});
