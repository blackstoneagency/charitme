import { describe, it, expect } from 'vitest';
import {
  generateApiKey,
  hashApiKey,
  bearerToken,
  looksLikeApiKey,
  keyGrants,
  safeEqual,
  keyFingerprint,
  KEY_PREFIX,
  API_SCOPES,
  isApiScope,
  type ApiKeyRow,
} from '../lib/api-keys';

// Credential code fails open, silently, and only for attackers — nobody
// legitimate ever reports it. Every branch that could accidentally authorise is
// asserted here rather than left to review.

describe('API key generation', () => {
  it('produces a prefixed, high-entropy, unique key', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { key } = generateApiKey();
      expect(key.startsWith(KEY_PREFIX)).toBe(true);
      expect(looksLikeApiKey(key)).toBe(true);
      seen.add(key);
    }
    expect(seen.size).toBe(200); // no collisions, i.e. it is actually random
  });

  it('never returns the plaintext inside the hash', () => {
    const { key, hash } = generateApiKey();
    expect(hash).not.toContain(key);
    expect(hash).toHaveLength(64); // sha256 hex
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashes deterministically, so lookup by hash works', () => {
    const { key, hash } = generateApiKey();
    expect(hashApiKey(key)).toBe(hash);
  });

  it('gives different keys different hashes', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.hash).not.toBe(b.hash);
  });

  it('exposes only the last four characters as a fingerprint', () => {
    const { key } = generateApiKey();
    const fp = keyFingerprint(key);
    expect(fp).toHaveLength(4);
    expect(key.endsWith(fp)).toBe(true);
  });
});

describe('bearerToken', () => {
  it('extracts a token regardless of header case', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123');
    expect(bearerToken('bearer abc123')).toBe('abc123');
    expect(bearerToken('  Bearer   abc123  ')).toBe('abc123');
  });

  it('returns null for anything that is not a bearer header', () => {
    for (const h of [null, '', 'abc123', 'Basic abc123', 'Bearer', 'Bearer ', 'Bearer a b']) {
      expect(bearerToken(h), String(h)).toBeNull();
    }
  });
});

describe('looksLikeApiKey', () => {
  it('accepts a real generated key', () => {
    expect(looksLikeApiKey(generateApiKey().key)).toBe(true);
  });

  it('rejects wrong prefix, wrong length, and wrong alphabet', () => {
    const body = 'a'.repeat(43);
    expect(looksLikeApiKey(null)).toBe(false);
    expect(looksLikeApiKey(undefined)).toBe(false);
    expect(looksLikeApiKey('')).toBe(false);
    expect(looksLikeApiKey('sk_live_' + body)).toBe(false);
    expect(looksLikeApiKey(KEY_PREFIX + 'a'.repeat(42))).toBe(false);
    expect(looksLikeApiKey(KEY_PREFIX + 'a'.repeat(44))).toBe(false);
    // '+' and '/' are base64, not base64url — a key containing them is not ours.
    expect(looksLikeApiKey(KEY_PREFIX + '+'.repeat(43))).toBe(false);
  });
});

describe('keyGrants', () => {
  const row = (over: Partial<ApiKeyRow> = {}): ApiKeyRow => ({
    id: 'k1',
    owner_id: 'u1',
    scopes: ['campaigns:read'],
    revoked_at: null,
    ...over,
  });

  it('grants a scope the key holds', () => {
    expect(keyGrants(row(), 'campaigns:read')).toBe(true);
  });

  it('denies a scope the key does not hold', () => {
    expect(keyGrants(row(), 'donations:read')).toBe(false);
  });

  it('denies a REVOKED key even when the scope matches', () => {
    // The second of two independent checks: the query filters revoked keys too,
    // so both would have to be wrong for a revoked key to authorise.
    expect(keyGrants(row({ revoked_at: new Date().toISOString() }), 'campaigns:read')).toBe(false);
  });

  it('denies a null row — an unknown key must never authorise', () => {
    expect(keyGrants(null, 'campaigns:read')).toBe(false);
  });

  it('denies when scopes is empty or not an array', () => {
    expect(keyGrants(row({ scopes: [] }), 'campaigns:read')).toBe(false);
    expect(keyGrants(row({ scopes: null as unknown as string[] }), 'campaigns:read')).toBe(false);
  });
});

describe('scopes', () => {
  it('are read-only at launch', () => {
    // A write scope must not appear by accident — it would need a route that
    // honours it, and none exists.
    for (const s of API_SCOPES) expect(s.endsWith(':read')).toBe(true);
  });

  it('validates scope strings from user input', () => {
    expect(isApiScope('campaigns:read')).toBe(true);
    expect(isApiScope('campaigns:write')).toBe(false);
    expect(isApiScope('*')).toBe(false);
    expect(isApiScope('')).toBe(false);
  });
});

describe('safeEqual', () => {
  it('is true only for identical strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('returns false rather than throwing on a length mismatch', () => {
    // timingSafeEqual throws when lengths differ; the wrapper must not.
    expect(() => safeEqual('a', 'abcdef')).not.toThrow();
    expect(safeEqual('a', 'abcdef')).toBe(false);
  });
});
