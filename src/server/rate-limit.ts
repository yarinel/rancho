/**
 * In-memory fixed-window rate limiter for public endpoints. Sufficient for a
 * single-instance P0 deployment; swap for a store-backed limiter when scaling.
 */

const windows = new Map<string, { count: number; resetAt: number }>();

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i;

/**
 * Trusted client key for rate limiting. Never trusts raw x-forwarded-for
 * verbatim (attacker-controlled): prefers the platform-set x-real-ip, else the
 * FIRST syntactically valid IP in XFF, else a single shared "unknown" bucket —
 * a rotating fake header can never mint fresh buckets.
 */
export function clientKeyFromHeaders(h: {
  get(name: string): string | null;
}): string {
  const real = h.get("x-real-ip")?.trim();
  if (real && IP_RE.test(real)) return real;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && IP_RE.test(first)) return first;
  }
  return "unknown";
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt < now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}
