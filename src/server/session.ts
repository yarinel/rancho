import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal HMAC-signed staff session token: `<userId>.<expiresEpoch>.<sig>`.
 * AUTH_SECRET must be set in production; the dev fallback is clearly labeled.
 */

const SECRET =
  process.env.AUTH_SECRET ??
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("AUTH_SECRET is required in production");
      })()
    : "rancho-dev-secret-not-for-production");

export const SESSION_COOKIE = "rancho_staff";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createSessionToken(
  userId: string,
  now = Date.now(),
): string {
  const expires = now + SESSION_TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): { userId: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, sig] = parts;
  const payload = `${userId}.${expiresStr}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < now) return null;
  return { userId };
}
