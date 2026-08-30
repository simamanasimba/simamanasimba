import { randomBytes, createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface OpaqueToken {
  /** Raw token — send to the client, never persisted in plaintext. */
  token: string;
  /** SHA-256 hex digest — safe to store and compare against in the database. */
  hash: string;
}

/** Generates an opaque bearer token (sessions, email verification, password reset, QR/attendance tokens). */
export function generateOpaqueToken(bytes = 32): OpaqueToken {
  const token = randomBytes(bytes).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateMembershipQrPayload(eventId: string, token: string): string {
  return JSON.stringify({ v: 1, eventId, token });
}
