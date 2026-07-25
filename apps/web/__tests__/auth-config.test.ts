import { describe, expect, it } from 'vitest';
import { safeNextPath, DEFAULT_SIGNED_IN_PATH } from '../lib/auth-config';

// safeNextPath sanitizes the post-login `?next=` param. It MUST never return an
// off-site or non-path destination (open-redirect / javascript: protection).
describe('safeNextPath', () => {
  it('falls back for null/undefined/empty', () => {
    expect(safeNextPath(null)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeNextPath(undefined)).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeNextPath('')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('keeps a same-site relative path (with query)', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/campaigns?category=Medical&page=2')).toBe('/campaigns?category=Medical&page=2');
    expect(safeNextPath('/create/choose-path')).toBe('/create/choose-path');
  });

  it('blocks absolute off-site URLs (open redirect)', () => {
    expect(safeNextPath('https://evil.com/phish')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeNextPath('http://attacker.example/login')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('blocks protocol-relative off-site URLs (//host)', () => {
    expect(safeNextPath('//evil.com')).toBe(DEFAULT_SIGNED_IN_PATH);
    expect(safeNextPath('//evil.com/path')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('blocks the javascript: scheme', () => {
    expect(safeNextPath('javascript:alert(1)')).toBe(DEFAULT_SIGNED_IN_PATH);
  });

  it('honors a custom fallback', () => {
    expect(safeNextPath(null, '/login')).toBe('/login');
    expect(safeNextPath('https://evil.com', '/home')).toBe('/home');
  });

  it('strips the host from an absolute same-origin URL, keeping only the path', () => {
    // Absolute URL to localhost resolves to its path — never leaks a host.
    expect(safeNextPath('http://localhost/dashboard?x=1')).toBe('/dashboard?x=1');
  });

  it('never returns a value containing a scheme or //host', () => {
    for (const raw of ['https://evil.com', '//evil.com', 'javascript:x', 'http://x.y/z']) {
      const out = safeNextPath(raw);
      expect(out.startsWith('/')).toBe(true);
      expect(out).not.toMatch(/^\/\//); // not protocol-relative
      expect(out).not.toContain('://');
    }
  });
});
