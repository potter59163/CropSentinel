import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adminSessionToken, isValidAdminPassword, isValidAdminToken } from './adminAuth';

describe('adminAuth — password gate for the hidden /admin/prices page', () => {
  const original = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'let-me-in';
  });
  afterEach(() => {
    process.env.ADMIN_PASSWORD = original;
  });

  it('accepts the correct password and rejects everything else', () => {
    expect(isValidAdminPassword('let-me-in')).toBe(true);
    expect(isValidAdminPassword('wrong')).toBe(false);
    expect(isValidAdminPassword('')).toBe(false);
    expect(isValidAdminPassword(undefined)).toBe(false);
  });

  it('derives a stable, non-plaintext session token from the password', () => {
    const token = adminSessionToken();
    expect(token).toBeTruthy();
    expect(token).not.toBe('let-me-in');
    expect(isValidAdminToken(token)).toBe(true);
    expect(isValidAdminToken('some-other-token')).toBe(false);
  });

  it('has no valid password or token when ADMIN_PASSWORD is unset', () => {
    delete process.env.ADMIN_PASSWORD;
    expect(isValidAdminPassword('anything')).toBe(false);
    expect(adminSessionToken()).toBeNull();
    expect(isValidAdminToken('anything')).toBe(false);
  });
});
