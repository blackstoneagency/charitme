import { describe, it, expect } from 'vitest';
import { normalizeUrl } from '../lib/normalize-url';

describe('normalizeUrl', () => {
  it('adds https:// to a bare domain', () => {
    expect(normalizeUrl('myorg.com')).toBe('https://myorg.com');
    expect(normalizeUrl('www.hope-foundation.org')).toBe('https://www.hope-foundation.org');
    expect(normalizeUrl('example.co.uk/donate')).toBe('https://example.co.uk/donate');
    expect(normalizeUrl('example.com:8080/x')).toBe('https://example.com:8080/x');
  });

  it('leaves an existing scheme untouched', () => {
    expect(normalizeUrl('https://myorg.com')).toBe('https://myorg.com');
    expect(normalizeUrl('http://myorg.com')).toBe('http://myorg.com');
    expect(normalizeUrl('HTTPS://MyOrg.com')).toBe('HTTPS://MyOrg.com');
    expect(normalizeUrl('//cdn.example.com/a.png')).toBe('//cdn.example.com/a.png');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  myorg.com  ')).toBe('https://myorg.com');
  });

  it('passes empty input straight through', () => {
    expect(normalizeUrl('')).toBe('');
    expect(normalizeUrl('   ')).toBe('');
  });

  it('does not invent a URL from something that is not a domain', () => {
    // These must stay invalid so the server still rejects them, rather than
    // being silently upgraded into a valid-looking URL.
    for (const junk of ['not a url', 'hello', 'myorg', '12345', 'a b.com']) {
      expect(normalizeUrl(junk)).toBe(junk);
    }
  });

  it('does not mangle a mailto: address', () => {
    expect(normalizeUrl('mailto:hi@example.com')).toBe('mailto:hi@example.com');
  });
});
