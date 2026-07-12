import { createHash, timingSafeEqual } from 'crypto';

const COOKIE_NAME = 'nan_admin_session';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function adminCookieName(): string {
  return COOKIE_NAME;
}

// The cookie carries a derived token, never the raw ADMIN_PASSWORD, so it's
// safe even if a cookie ever leaks (log line, browser devtools, etc).
export function adminSessionToken(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash('sha256').update(password).digest('hex');
}

export function isValidAdminPassword(password: string | undefined | null): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !password) return false;
  return safeCompare(password, expected);
}

export function isValidAdminToken(token: string | undefined | null): boolean {
  const expected = adminSessionToken();
  if (!expected || !token) return false;
  return safeCompare(token, expected);
}
