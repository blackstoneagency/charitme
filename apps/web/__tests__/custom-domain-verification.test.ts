import { describe, it, expect } from 'vitest';
import { normalizeDomain, verifyDomainOwnership, TXT_PREFIX } from '../lib/custom-domains';

// ─────────────────────────────────────────────────────────────────────────────
// The normalised domain is interpolated into a DNS query, and the verification
// result decides whether the platform asserts someone owns a hostname. Both
// deserve tests: the first because it takes user input into a lookup, the second
// because "verified" is a claim about the outside world.
// ─────────────────────────────────────────────────────────────────────────────

describe('domain normalisation', () => {
  it.each([
    ['https://www.example.com/give', 'www.example.com'],
    ['HTTP://Example.COM', 'example.com'],
    ['example.com.', 'example.com'],
    ['  give.example.org  ', 'give.example.org'],
  ])('accepts %s as %s', (input, expected) => {
    const r = normalizeDomain(input);
    expect(r.ok && r.domain).toBe(expected);
  });

  it.each([
    'localhost',            // single label — an internal name, not a domain
    'example',              // single label
    'user@example.com',     // email
    'example.com:8080',     // port
    '10.0.0.1',             // bare IP
    '-bad.example.com',     // label may not start with a hyphen
    'bad-.example.com',     // …or end with one
    'exa mple.com',         // whitespace would break the DNS query
    '',
  ])('rejects %s', (input) => {
    expect(normalizeDomain(input).ok).toBe(false);
  });
});

describe('ownership verification reports what DNS actually said', () => {
  const TOKEN = 'charitme-verify-abc123';

  it('verifies when the token is present', async () => {
    const r = await verifyDomainOwnership('example.com', TOKEN, async () => [[TOKEN]]);
    expect(r.verified).toBe(true);
  });

  it('joins chunked TXT records before comparing', async () => {
    // Resolvers split strings over 255 bytes. Comparing per-chunk would fail
    // against a correctly configured record — the user would be told their DNS
    // was wrong when it was right.
    const r = await verifyDomainOwnership('example.com', TOKEN, async () => [
      ['charitme-verify-', 'abc123'],
    ]);
    expect(r.verified).toBe(true);
  });

  it('does not verify on a different token', async () => {
    const r = await verifyDomainOwnership('example.com', TOKEN, async () => [['someone-elses-token']]);
    expect(r.verified).toBe(false);
    expect(r.verified === false && r.reason).toMatch(/does not match/);
  });

  it('queries the prefixed host, not the bare domain', async () => {
    let asked = '';
    await verifyDomainOwnership('example.com', TOKEN, async (host) => {
      asked = host;
      return [[TOKEN]];
    });
    expect(asked).toBe(`${TXT_PREFIX}.example.com`);
  });

  it('treats a lookup failure as NOT verified, and says it could not ask', async () => {
    // The distinction that matters: "there is no record" and "we could not check"
    // are different messages, and neither is "verified".
    const r = await verifyDomainOwnership('example.com', TOKEN, async () => {
      throw Object.assign(new Error('boom'), { code: 'ESERVFAIL' });
    });
    expect(r.verified).toBe(false);
    expect(r.verified === false && r.reason).toMatch(/not proof/);
  });

  it('reports a missing record distinctly from a failed lookup', async () => {
    const r = await verifyDomainOwnership('example.com', TOKEN, async () => {
      throw Object.assign(new Error('nope'), { code: 'ENOTFOUND' });
    });
    expect(r.verified).toBe(false);
    expect(r.verified === false && r.reason).toMatch(/No TXT record/);
  });
});
