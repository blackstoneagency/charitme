#!/usr/bin/env node
/**
 * A local stand-in for Supabase: GoTrue `/auth/v1` + PostgREST `/rest/v1`,
 * enough of each that the Next app renders signed-in pages.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Every accessibility, contrast and responsive sweep in this repo covers *public*
 * routes only. The auth-gated half of the product — 13 gated routes plus all of
 * `/dashboard/*` and `/admin/*` — has never been audited by any of them, and the
 * tracker recorded the reason as "needs egress to Supabase, owner must unblock".
 *
 * That reason is wrong, and it is worth being precise about why, because the same
 * mistake will otherwise be repeated for every future audit:
 *
 *   The sweeps do not need THE production Supabase. They need A Supabase — any
 *   host that answers `GET /auth/v1/user` with a user and `GET /rest/v1/<table>`
 *   with rows. Nothing in a contrast or axe measurement depends on the data being
 *   real; it depends on the page RENDERING, and the page renders as soon as auth
 *   resolves and reads return something shaped correctly.
 *
 * So the blocker was never the firewall. It was that no one had separated "I need
 * production data" from "I need a page to render".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DELIBERATELY IS NOT
 *
 * Not a Supabase emulator, and it must never grow into one. It answers the narrow
 * set of requests the app actually makes during a page render. It has no RLS, no
 * joins, no auth verification — a stub that enforced policies would be a second
 * implementation of the security model, which is a worse thing to own than no
 * stub at all.
 *
 * That has a hard consequence for how results may be reported: a page that
 * renders against this stub is proof about LAYOUT, COLOUR and MARKUP. It is not
 * proof that the query is correct, that RLS admits the right rows, or that the
 * feature works. Do not let a green sweep here be written up as "the dashboard
 * works" — it means "the dashboard is legible in both themes".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXTURES
 *
 * Rows come from `scripts/supabase-stub-fixtures.mjs`. They are populated on
 * purpose: an earlier finding in todo.md ("the a11y 0-violations claim is vacuous
 * for data-backed sections") was exactly this trap — sweeping a page whose
 * data-conditional half never rendered, then reporting the page as clean. Empty
 * fixtures would reproduce it in a new place.
 *
 * Usage:
 *   node scripts/supabase-stub.mjs --port 54321
 */

import { createServer } from 'node:http';
import { buildFixtures } from './supabase-stub-fixtures.mjs';

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
};

const PORT = Number(argOf('--port', '54321'));
const VERBOSE = args.includes('--verbose');

const fixtures = buildFixtures();

const USER = fixtures._user;
const PERSONAS = fixtures._personas;
const DEFAULT_PERSONA = PERSONAS.find((persona) => persona.user.id === USER.id);
const PERSONA_BY_TOKEN = new Map(PERSONAS.map((persona) => [persona.token, persona]));

/** GoTrue returns the user object at the top level, not wrapped in `data`. */
function personaFromRequest(req) {
  const header = req.headers.authorization ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return DEFAULT_PERSONA;
  return PERSONA_BY_TOKEN.get(token) ?? null;
}

function session(persona = DEFAULT_PERSONA) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: persona.token,
    refresh_token: `stub-${persona.key}-refresh-token`,
    token_type: 'bearer',
    // Far future so the client never tries to refresh mid-sweep; a refresh storm
    // would make page timings meaningless.
    expires_in: 60 * 60 * 24 * 365,
    expires_at: now + 60 * 60 * 24 * 365,
    user: persona.user,
  };
}

// ─── PostgREST-ish querying ──────────────────────────────────────────────────
//
// Supports only what the app's reads actually use: eq/neq/gt/gte/lt/lte/in/is,
// `or=`, `order`, `limit`, `offset`, and `select` column projection. Anything
// unrecognised is IGNORED rather than erroring — an unsupported filter that
// returned 400 would blank the page and silently shrink audit coverage, which is
// the failure mode this whole script exists to prevent. Over-returning rows is
// the safe direction here: the page renders more, not less.

function coerce(raw) {
  if (raw === 'null') return null;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw.replace(/^"|"$/g, '');
}

function matches(row, column, expr) {
  const [op, ...rest] = expr.split('.');
  const raw = rest.join('.');
  const value = row?.[column];

  switch (op) {
    case 'eq': return String(value) === String(coerce(raw));
    case 'neq': return String(value) !== String(coerce(raw));
    case 'gt': return Number(value) > Number(raw);
    case 'gte': return Number(value) >= Number(raw);
    case 'lt': return Number(value) < Number(raw);
    case 'lte': return Number(value) <= Number(raw);
    case 'is': return raw === 'null' ? value == null : Boolean(value) === (raw === 'true');
    case 'in': {
      const set = raw.replace(/^\(|\)$/g, '').split(',').map((v) => String(coerce(v)));
      return set.includes(String(value));
    }
    case 'like':
    case 'ilike': {
      const pattern = raw.replace(/\*/g, '').replace(/%/g, '').toLowerCase();
      return String(value ?? '').toLowerCase().includes(pattern);
    }
    default:
      return true; // unknown operator — see note above
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'and', 'or', 'not']);

function query(table, params) {
  let rows = Array.isArray(fixtures[table]) ? [...fixtures[table]] : [];

  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue;
    rows = rows.filter((row) => matches(row, key, raw));
  }

  const order = params.get('order');
  if (order) {
    const [column, dir = 'asc'] = order.split('.');
    rows.sort((a, b) => {
      const av = a?.[column];
      const bv = b?.[column];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return dir.startsWith('desc') ? -cmp : cmp;
    });
  }

  const offset = Number(params.get('offset') ?? 0);
  const limit = params.get('limit');
  const total = rows.length;
  rows = rows.slice(offset, limit ? offset + Number(limit) : undefined);

  return { rows, total };
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'content-range',
    ...headers,
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  if (VERBOSE) console.log(`${req.method} ${path}${url.search}`);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // ── auth ──────────────────────────────────────────────────────────────────
  if (path === '/auth/v1/user') {
    const persona = personaFromRequest(req);
    if (!persona) return send(res, 401, { message: 'Invalid stub access token' });
    return send(res, 200, persona.user);
  }
  if (path === '/auth/v1/token') return send(res, 200, session());
  if (path === '/auth/v1/logout') return send(res, 204, '');
  if (path.startsWith('/auth/v1/')) return send(res, 200, {});

  // ── postgrest ─────────────────────────────────────────────────────────────
  if (path.startsWith('/rest/v1/rpc/')) {
    const fn = path.slice('/rest/v1/rpc/'.length);
    const value = fixtures._rpc?.[fn];
    return send(res, 200, value === undefined ? null : value);
  }

  if (path.startsWith('/rest/v1/')) {
    const table = path.slice('/rest/v1/'.length);

    // Writes are accepted and discarded. A sweep should never mutate anything,
    // but a page that fires a write on render (last_seen_at, and similar) must
    // not see a failure and switch to an error state.
    if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 201, [], { 'content-range': '*/1' });
    }

    const { rows, total } = query(table, url.searchParams);
    const single = (req.headers.accept ?? '').includes('vnd.pgrst.object');
    if (single) {
      if (!rows.length) {
        return send(res, 406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        });
      }
      return send(res, 200, rows[0], { 'content-range': '0-0/1' });
    }
    return send(res, 200, rows, {
      'content-range': `0-${Math.max(rows.length - 1, 0)}/${total}`,
    });
  }

  send(res, 200, {});
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`supabase-stub listening on http://127.0.0.1:${PORT}`);
});
