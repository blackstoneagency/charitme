import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateWebhookUrl, generateWebhookSecret, hashWebhookSecret, isWebhookEvent } from '../lib/webhook-endpoint-access';

// ─────────────────────────────────────────────────────────────────────────────
// Outbound webhook endpoints are a URL the SERVER will fetch, supplied by a
// user. Unvalidated, that is a server-side request forgery primitive: the cloud
// metadata endpoint (169.254.169.254) hands out credentials, and loopback or
// RFC1918 hosts reach internal services that trust their network.
// ─────────────────────────────────────────────────────────────────────────────

describe('webhook URLs cannot point inward', () => {
  it.each([
    'http://example.com/hook',            // plaintext
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5/hook',
    'https://192.168.1.10/hook',
    'https://172.16.0.9/hook',
    'https://172.31.255.1/hook',
    'https://db.internal/hook',
    'ftp://example.com/hook',
    'not a url',
  ])('rejects %s', (url) => {
    expect(validateWebhookUrl(url).ok).toBe(false);
  });

  it.each([
    'https://example.com/webhooks/charitme',
    'https://hooks.example.co.uk/a/b?c=1',
    // 172.32 is OUTSIDE the private 172.16–172.31 range: the guard must not
    // over-match and reject legitimate public addresses.
    'https://172.32.0.1/hook',
  ])('allows %s', (url) => {
    expect(validateWebhookUrl(url).ok).toBe(true);
  });

  it('is re-applied on update, not only on create', () => {
    // Validating only at creation would let an endpoint be created with a public
    // https URL and then repointed at the metadata service.
    const src = readFileSync(join(__dirname, '..', 'app/api/webhook-endpoints/[id]/route.ts'), 'utf8');
    expect(src).toMatch(/validateWebhookUrl\(/);
  });
});

describe('the signing secret is never stored in plaintext', () => {
  it('stores a hash and returns the secret once', () => {
    const { secret, hash } = generateWebhookSecret();
    expect(secret.startsWith('whsec_')).toBe(true);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(secret);
    expect(hashWebhookSecret(secret)).toBe(hash);
  });

  it('no route ever selects secret_hash back out', () => {
    for (const p of ['app/api/webhook-endpoints/route.ts', 'app/api/webhook-endpoints/[id]/route.ts']) {
      const src = readFileSync(join(__dirname, '..', p), 'utf8');
      const selects = [...src.matchAll(/const SELECT =\s*'([^']+)'/g)].map((m) => m[1]);
      expect(selects.length).toBeGreaterThan(0);
      for (const s of selects) expect(s, `${p} returns secret_hash to the client`).not.toContain('secret_hash');
    }
  });
});

describe('subscribable events are a closed set', () => {
  it('accepts known events and rejects typos', () => {
    expect(isWebhookEvent('donation.created')).toBe(true);
    // A free-text field would store this happily and never match anything, so
    // the subscriber waits forever for a delivery never attempted.
    expect(isWebhookEvent('donation.creted')).toBe(false);
  });
});
