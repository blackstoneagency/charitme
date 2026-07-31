import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from './supabase';
import { checkRateLimit } from './rate-limit';
import {
  bearerToken,
  hashApiKey,
  keyGrants,
  looksLikeApiKey,
  type ApiKeyRow,
  type ApiScope,
} from './api-keys';

// ─────────────────────────────────────────────────────────────────────────────
// Authentication for `/api/v1/*` — the public API.
//
// One function, used by every v1 route, because the failure mode of "each route
// checks its own key" is that one of them eventually does not. `requireApiKey`
// returns either an authenticated context or a Response to return verbatim; a
// route cannot accidentally proceed on failure because it has no context to
// proceed with.
//
// ⚠️ Rate limiting is keyed on the API KEY, not the IP. Every serious consumer of
// this API is a server, and a fleet behind one NAT would otherwise share one
// bucket while a single attacker rotating IPs would get an unlimited one. The
// limit is per credential, which is the thing that was actually issued.
// ─────────────────────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_MINUTE = 120;

export interface ApiContext {
  keyId: string;
  ownerId: string;
  scopes: string[];
}

type AuthResult = { ok: true; ctx: ApiContext } | { ok: false; response: NextResponse };

/** RFC-ish error body, stable shape so clients can branch on `code`. */
export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function requireApiKey(request: NextRequest, scope: ApiScope): Promise<AuthResult> {
  const presented = bearerToken(request.headers.get('authorization'));

  // Shape-check before touching the database: an unauthenticated flood must not
  // become a query per request.
  if (!looksLikeApiKey(presented)) {
    return {
      ok: false,
      response: apiError(
        401,
        'unauthorized',
        'Provide an API key as `Authorization: Bearer cm_live_…`. Create one at /dashboard/developers.',
      ),
    };
  }

  const hash = hashApiKey(presented!);
  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, owner_id, scopes, revoked_at')
    .eq('key_hash', hash)
    // Filtered here AND re-checked in keyGrants — both must fail for a revoked
    // key to be accepted.
    .is('revoked_at', null)
    .maybeSingle();

  if (error) {
    return { ok: false, response: apiError(500, 'internal_error', 'Could not verify the API key.') };
  }

  const row = (data as ApiKeyRow | null) ?? null;

  // Same message and status for "no such key" and "revoked key". Distinguishing
  // them tells someone probing with a stolen key whether it was ever real.
  if (!row) {
    return { ok: false, response: apiError(401, 'unauthorized', 'That API key is not valid.') };
  }

  if (!checkRateLimit(`api-v1:${row.id}`, RATE_LIMIT_PER_MINUTE, 60_000)) {
    return {
      ok: false,
      response: apiError(429, 'rate_limited', `Rate limit is ${RATE_LIMIT_PER_MINUTE} requests per minute per key.`),
    };
  }

  if (!keyGrants(row, scope)) {
    return {
      ok: false,
      response: apiError(403, 'insufficient_scope', `This key does not have the \`${scope}\` scope.`, {
        required_scope: scope,
      }),
    };
  }

  // Best-effort usage stamp. Deliberately NOT awaited into the response path and
  // never able to fail the request: `last_used_at` is an operator convenience,
  // and a write error here must not turn a valid API call into a 500.
  void supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)
    .then(
      () => {},
      () => {},
    );

  return { ok: true, ctx: { keyId: row.id, ownerId: row.owner_id, scopes: row.scopes } };
}

/** Shared pagination: `?limit=` (1–100, default 25) and `?offset=`. */
export function readPaging(request: NextRequest): { limit: number; offset: number } {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  return { limit, offset };
}

/** Every v1 response carries the same envelope, so clients can page uniformly. */
export function apiList<T>(data: T[], paging: { limit: number; offset: number }, total: number | null) {
  return NextResponse.json(
    { data, pagination: { limit: paging.limit, offset: paging.offset, total } },
    // Authenticated, per-key data: never cacheable by a shared proxy.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
