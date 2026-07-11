import { describe, it, expect } from 'vitest';
import { rateLimit, clientIp } from './rateLimit';

describe('clientIp — must not trust client-controllable XFF', () => {
  const req = (headers: Record<string, string>) => new Request('https://x/', { headers });

  it('prefers x-real-ip (Vercel-set, non-spoofable)', () => {
    expect(clientIp(req({ 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.2.3.4, 203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('uses the RIGHTMOST forwarded-for entry, never the client-supplied leftmost', () => {
    // attacker spoofs the leftmost token; the trusted proxy appends the real IP on the right
    expect(clientIp(req({ 'x-forwarded-for': 'spoofed-fake, 203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('falls back to a constant when no proxy header is present (no per-request uniqueness to abuse)', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('rateLimit — fixed-window per-key limiter', () => {
  it('allows requests up to the limit then blocks within the window', () => {
    const key = `test-allow-${Math.round(performance.now())}`;
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, 5, 60_000, t0);
      expect(r.ok).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000, t0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    const key = `test-reset-${Math.round(performance.now())}`;
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) rateLimit(key, 3, 60_000, t0);
    expect(rateLimit(key, 3, 60_000, t0).ok).toBe(false);
    // advance past the window
    expect(rateLimit(key, 3, 60_000, t0 + 60_001).ok).toBe(true);
  });

  it('tracks separate keys independently', () => {
    const t0 = 3_000_000;
    const a = `test-a-${Math.round(performance.now())}`;
    const b = `test-b-${Math.round(performance.now())}`;
    rateLimit(a, 1, 60_000, t0);
    expect(rateLimit(a, 1, 60_000, t0).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000, t0).ok).toBe(true); // different key unaffected
  });

  it('reports decreasing remaining budget', () => {
    const key = `test-remaining-${Math.round(performance.now())}`;
    const t0 = 4_000_000;
    expect(rateLimit(key, 3, 60_000, t0).remaining).toBe(2);
    expect(rateLimit(key, 3, 60_000, t0).remaining).toBe(1);
    expect(rateLimit(key, 3, 60_000, t0).remaining).toBe(0);
  });
});
