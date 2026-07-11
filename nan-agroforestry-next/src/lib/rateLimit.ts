// Lightweight fixed-window rate limiter (per key, in-process).
//
// SCOPE: this is a per-instance in-memory guard — good enough to stop a single
// client from hammering the expensive /api/plan (which fans out to NASA POWER,
// GISTDA, SoilGrids) or spamming /api/field-feedback into the database. On
// Vercel's serverless fleet each instance keeps its own map, so the *effective*
// global limit is (limit × warm instances). For a hard, fleet-wide limit move
// this to Vercel KV / Upstash Redis (see the 40k grant line item) — the call
// sites below won't need to change, only this module's internals.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;
// Hard ceiling so an adversarial flood of unique keys within a single window
// (which the expired-only sweep below cannot reclaim yet) can't exhaust memory.
// Map preserves insertion order, so evicting the oldest keys is FIFO.
const MAX_BUCKETS = 100_000;

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key    stable identifier for the caller (usually client IP + route)
 * @param limit  max requests allowed per window
 * @param windowMs  window length in ms
 * @param now    injectable clock for testing (defaults to Date.now())
 */
export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateResult {
  // opportunistic GC so the map can't grow unbounded from unique IPs
  if (now - lastSweep > windowMs) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    lastSweep = now;
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Only a genuinely new key grows the map; reset-in-place reuses the slot.
    if (!bucket && buckets.size >= MAX_BUCKETS) {
      let toEvict = buckets.size - MAX_BUCKETS + 1;
      for (const k of buckets.keys()) { buckets.delete(k); if (--toEvict <= 0) break; }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}

// Best-effort client IP for rate-limit keying.
// SECURITY: the LEFTMOST x-forwarded-for token is whatever the client sent, so
// keying on it lets an attacker rotate a fake XFF per request and bypass the
// limit entirely (and balloon the bucket map). Vercel overwrites `x-real-ip`
// with the true client IP, so prefer it; only if it is absent fall back to the
// RIGHTMOST XFF entry — the hop the closest trusted proxy appended.
export function clientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return 'unknown';
}

// Shared helper: returns a 429 Response when over the limit, else null.
export function rateLimited(request: Request, route: string, limit: number, windowMs: number): Response | null {
  const res = rateLimit(`${route}:${clientIp(request)}`, limit, windowMs);
  if (res.ok) return null;
  return new Response(
    JSON.stringify({ error: 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', retryAfterSec: res.retryAfterSec }),
    { status: 429, headers: { 'content-type': 'application/json', 'Retry-After': String(res.retryAfterSec) } },
  );
}
