import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPlaceholderUrl, realUrlOrNull } from '../lib/placeholder-url';

// ─────────────────────────────────────────────────────────────────────────────
// Production data carries RFC 2606 documentation domains: 240 grants with an
// `example.org` "Apply" link and 120 events with an `example.org` "Join link".
// Both rendered as live links that can never resolve — a dead end at exactly the
// moment someone tries to apply or join.
//
// The detector must be NARROW. Hiding a real fundraiser's link would be a worse
// bug than the one it fixes, so anything not positively recognised stays visible.
// ─────────────────────────────────────────────────────────────────────────────

describe('isPlaceholderUrl recognises reserved documentation addresses', () => {
  it('catches the RFC 2606 §3 second-level names', () => {
    for (const url of [
      'https://example.org/grants/1',
      'https://example.com/apply',
      'http://example.net',
      'https://EXAMPLE.ORG/live/2',
    ]) {
      expect(isPlaceholderUrl(url), url).toBe(true);
    }
  });

  it('catches subdomains of them', () => {
    expect(isPlaceholderUrl('https://docs.example.org/x')).toBe(true);
    expect(isPlaceholderUrl('https://a.b.example.com/')).toBe(true);
  });

  it('catches the RFC 2606 §2 reserved TLDs', () => {
    for (const url of [
      'https://foo.test/',
      'https://anything.invalid/',
      'https://site.example/',
      'http://localhost:3000/x',
      'http://api.localhost/x',
    ]) {
      expect(isPlaceholderUrl(url), url).toBe(true);
    }
  });

  it('handles a fully-qualified trailing dot', () => {
    expect(isPlaceholderUrl('https://example.org./x')).toBe(true);
  });
});

describe('isPlaceholderUrl leaves real links alone', () => {
  it('does not touch ordinary funder and meeting URLs', () => {
    for (const url of [
      'https://www.gatesfoundation.org/apply',
      'https://zoom.us/j/123456',
      'https://meet.google.com/abc-defg-hij',
      'https://charitme.com/grants',
      'https://my-example.org/apply',       // "example" only as part of a longer label
      'https://exampleorg.com/apply',
      'https://notexample.com/x',
    ]) {
      expect(isPlaceholderUrl(url), url).toBe(false);
    }
  });

  it('treats relative paths as internal links, never placeholders', () => {
    expect(isPlaceholderUrl('/grants/apply')).toBe(false);
    expect(isPlaceholderUrl('grants')).toBe(false);
  });

  it('returns false for junk rather than hiding something', () => {
    for (const value of [null, undefined, 42, {}, '', '   ']) {
      expect(isPlaceholderUrl(value)).toBe(false);
    }
  });
});

describe('realUrlOrNull', () => {
  it('passes a real URL through, trimmed of surrounding space', () => {
    expect(realUrlOrNull('https://zoom.us/j/1')).toBe('https://zoom.us/j/1');
    expect(realUrlOrNull('  https://zoom.us/j/1  ')).toBe('https://zoom.us/j/1');
  });

  it('nulls a placeholder and an empty value alike', () => {
    expect(realUrlOrNull('https://example.org/live/2')).toBeNull();
    expect(realUrlOrNull('')).toBeNull();
    expect(realUrlOrNull(null)).toBeNull();
  });
});

describe('the dead links are actually guarded at the render sites', () => {
  it('the event Join link is suppressed for a placeholder', () => {
    const src = readFileSync(join(__dirname, '../app/events/[slug]/page.tsx'), 'utf8');
    expect(src).toContain('realUrlOrNull(e.virtual_url)');
    // The bare truthiness check is what shipped the dead link.
    expect(src).not.toMatch(/\{e\.virtual_url && open &&/);
  });

  it("the grant funder link is suppressed for a placeholder", () => {
    const src = readFileSync(join(__dirname, '../app/grants/[slug]/page.tsx'), 'utf8');
    expect(src).toContain('realUrlOrNull(grant.application_url)');
    expect(src).not.toMatch(/\{grant\.application_url && \(/);
  });
});
