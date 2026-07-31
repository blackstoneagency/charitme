import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Public API key handling.
//
// `api_keys` shipped with `key_hash`, `scopes`, `revoked_at` and `last_used_at`
// and had no reader or writer — the third orphan table found this way. This is
// the credential layer for the public API.
//
// ⚠️ THE PLAINTEXT KEY IS NEVER STORED. Only its SHA-256 hash goes to the
// database, and the plaintext is returned exactly once, at creation. That is not
// ceremony: `api_keys` is readable by any code holding the service-role client,
// and a leaked database dump containing usable credentials is a different
// severity of incident from one containing hashes.
//
// SHA-256 rather than bcrypt/argon2 deliberately, and the reasoning is the
// opposite of the password case: an API key is 256 bits of CSPRNG output, so it
// has no dictionary to attack and stretching buys nothing. What matters instead
// is that verification is FAST, because it runs on every API request — a bcrypt
// round per request would be a self-inflicted rate limit.
// ─────────────────────────────────────────────────────────────────────────────

/** Live keys only for now. A `cm_test_` prefix is reserved for when test mode ships. */
export const KEY_PREFIX = 'cm_live_';

/** Scopes are READ-ONLY at launch. See `/developers` — writes need their own design. */
export const API_SCOPES = ['campaigns:read', 'donations:read', 'profile:read'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/**
 * A new key and its hash. The caller stores `hash` and shows `key` once.
 *
 * 32 bytes = 256 bits of entropy. base64url so the key is copy-pasteable and
 * safe in a header without escaping.
 */
export function generateApiKey(): { key: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString('base64url');
  return { key, hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * The last four characters, for showing a user WHICH key a row is.
 * Never enough to reconstruct the key; enough to tell two keys apart in a list.
 */
export function keyFingerprint(key: string): string {
  return key.slice(-4);
}

/** Extract a bearer token from an Authorization header. Null when absent or malformed. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

/** Shape check before any database work — rejects obvious junk without a query. */
export function looksLikeApiKey(value: string | null | undefined): boolean {
  if (!value || !value.startsWith(KEY_PREFIX)) return false;
  const body = value.slice(KEY_PREFIX.length);
  // 32 bytes base64url is 43 characters, unpadded.
  return body.length === 43 && /^[A-Za-z0-9_-]+$/.test(body);
}

/**
 * Constant-time comparison, for anywhere a key is compared directly rather than
 * looked up by hash. `timingSafeEqual` throws on length mismatch, so the lengths
 * are checked first — and that check is itself safe, because the length of an API
 * key is not a secret.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface ApiKeyRow {
  id: string;
  owner_id: string;
  scopes: string[];
  revoked_at: string | null;
}

/**
 * Is this key usable for this scope right now?
 *
 * Revocation is checked HERE rather than only in the query, so a caller that
 * forgets `.is('revoked_at', null)` still cannot authorise a revoked key. Two
 * places must both fail for a revoked key to work.
 */
export function keyGrants(row: ApiKeyRow | null, scope: ApiScope): boolean {
  if (!row) return false;
  if (row.revoked_at !== null) return false;
  return Array.isArray(row.scopes) && row.scopes.includes(scope);
}
