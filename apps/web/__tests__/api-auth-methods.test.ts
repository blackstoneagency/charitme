import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API_DIR = join(__dirname, '..', 'app', 'api');

/** Every route.ts under app/api, with its URL path. */
function routeFiles(): { url: string; file: string; src: string }[] {
  const out: { url: string; file: string; src: string }[] = [];
  const walk = (dir: string, url: string) => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) { walk(p, `${url}/${entry}`); continue; }
      if (entry !== 'route.ts') continue;
      out.push({ url, file: p, src: readFileSync(p, 'utf8') });
    }
  };
  walk(API_DIR, '/api');
  return out;
}

/**
 * The body of one exported HTTP handler, brace-matched.
 *
 * The parameter list must be skipped FIRST. Next route handlers are commonly
 * `POST(req, { params }: { params: Promise<{ id: string }> })`, and naively
 * taking the next `{` lands on that destructuring pattern rather than the body —
 * which reported 31 perfectly-guarded `[id]` routes as unguarded. All 31 were
 * dynamic routes, a shape no real defect has; that tell is what exposed it.
 */
function handlerBody(src: string, method: string): string | null {
  const m = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`).exec(src);
  if (!m) return null;
  // Walk the parameter list to its matching ')' so nested braces/parens are safe.
  let depth = 1;
  let k = m.index + m[0].length;
  for (; k < src.length && depth > 0; k++) {
    if (src[k] === '(') depth++;
    else if (src[k] === ')') depth--;
  }
  if (depth !== 0) return null;
  const i = src.indexOf('{', k);
  if (i === -1) return null;
  depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(i, j + 1); }
  }
  return null;
}

const GUARD = /verifyAdmin|requireAdmin|guardSuperAdmin|requireUser|isAdmin|isSuperAdmin|auth\.getUser|getUser\(\)|checkRateLimit/;

// ─────────────────────────────────────────────────────────────────────────────
// A guard somewhere in the file is not a guard on the handler.
//
// `GET /api/admin/sponsors` had NO auth check while POST, PATCH and DELETE all
// called verifyAdmin(). It read through `supabaseAdmin` (service role, RLS
// bypassed) and — measured against the live database — returned all 50 sponsor
// rows to an anonymous caller, including the 10 with `active: false` that the
// public /api/sponsors deliberately withholds.
//
// api-auth-coverage.test.ts scans the FILE and passed, because POST's guard is
// in the file. e2e/auth-gates.spec.ts probes two hardcoded endpoints. This test
// closes the gap between them: under /api/admin, EVERY exported handler must
// carry its own check.
// ─────────────────────────────────────────────────────────────────────────────
describe('every admin API handler guards itself, not just its file', () => {
  const adminRoutes = routeFiles().filter((r) => r.url.startsWith('/api/admin'));

  it('finds the admin routes (non-vacuity)', () => {
    expect(adminRoutes.length).toBeGreaterThan(20);
  });

  it('no exported handler is missing an auth check', () => {
    const unguarded: string[] = [];
    for (const route of adminRoutes) {
      for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
        const body = handlerBody(route.src, method);
        if (body === null) continue;
        if (!GUARD.test(body)) unguarded.push(`${method} ${route.url}`);
      }
    }
    expect(
      unguarded,
      'These admin handlers have no auth check of their own. A guard elsewhere in\n' +
        'the same file does not protect them — that is how GET /api/admin/sponsors\n' +
        'served 10 unpublished sponsor rows to anonymous callers.',
    ).toEqual([]);
  });

  it('the extractor really isolates one handler (non-vacuity)', () => {
    // If handlerBody returned the whole file, the check above would be worthless.
    const src = `
      export async function GET() { return 1; }
      export async function POST() { const a = await verifyAdmin(); return a; }
    `;
    expect(handlerBody(src, 'GET')).not.toMatch(/verifyAdmin/);
    expect(handlerBody(src, 'POST')).toMatch(/verifyAdmin/);
    expect(handlerBody(src, 'DELETE')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API routes must DENY, not redirect.
//
// `requireAdmin()` / `requireUser()` / `requireSuperAdmin()` are PAGE helpers —
// they call `redirect()`. Used in a route handler, a `fetch` caller receives a
// 307 and then an HTML login page, so `res.json()` throws and the UI reports a
// generic connection error instead of "your session expired".
//
// Four admin GETs did exactly this (`countries`, `nonprofits`,
// `payments/export`, `seed-support`), found by probing every route with
// scripts/audit-api-auth-live.mjs rather than by reading the handlers.
// `verifyAdmin()` is the API-side equivalent and returns null.
// ─────────────────────────────────────────────────────────────────────────────
describe('API routes deny rather than redirect', () => {
  // These are legitimate redirects: OAuth and Stripe Connect entry points whose
  // whole purpose is to send the browser somewhere.
  const REDIRECT_BY_DESIGN = new Set(['/api/auth/signin', '/api/auth/callback', '/api/stripe/connect']);

  const routes = routeFiles().filter((r) => !REDIRECT_BY_DESIGN.has(r.url));

  it('no route handler uses a page-redirecting auth helper', () => {
    const offenders: string[] = [];
    for (const route of routes) {
      for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
        const body = handlerBody(route.src, method);
        if (body === null) continue;
        if (/\b(requireAdmin|requireSuperAdmin|requireUser)\s*\(/.test(body)) {
          offenders.push(`${method} ${route.url}`);
        }
      }
    }
    expect(
      offenders,
      'These handlers call a PAGE auth helper, which redirects. An API caller gets\n' +
        'HTML and res.json() throws. Use verifyAdmin() (or auth.getUser() + 401).',
    ).toEqual([]);
  });

  it('the helpers really do redirect, so this guard is warranted', () => {
    // Non-vacuity: if requireAdmin stopped redirecting, this rule would be noise.
    const auth = readFileSync(join(__dirname, '..', 'lib', 'auth.ts'), 'utf8');
    expect(auth).toMatch(/export async function requireAdmin[\s\S]{0,200}redirect\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A guard placed AFTER the work it gates is not a guard.
//
// The api-auth-coverage scan proves a handler contains a check; this proves the
// check runs FIRST. A handler that queries (or worse, writes) and only then
// calls verifyAdmin() has already done the thing — it just declines to return
// the result, and any write has already landed.
//
// This is the third distinct claim about the same handlers, and each previous
// one was true while the next was false:
//   1. "contains a guard"  → api-auth-coverage.test.ts
//   2. "denies rather than redirects" → above, found 8 offenders
//   3. "denies BEFORE acting" → this test
// ─────────────────────────────────────────────────────────────────────────────
describe('the auth check runs before any database work', () => {
  // Helpers that ALWAYS deny. Their presence alone means the route is gated.
  const HARD_GUARD = /\b(?:verifyAdmin|guardSuperAdmin|requireAdmin|requireSuperAdmin|requireUser)\s*\(/;
  // `auth.getUser()` is ambiguous: it gates a route only when its result is used
  // to REFUSE. Several public routes call it to ATTRIBUTE instead — /api/donations
  // allows anonymous giving and reads the session only to link the donor,
  // /api/campaigns/[id]/messages and /api/ai/grant-match likewise personalise a
  // public response. Treating those as guards flagged all three as "queries before
  // authenticating", which was wrong: they are not authenticating at all.
  const SOFT_GUARD = /auth\.getUser\s*\(/;
  const DENIES = /status:\s*40[13]\b/;
  const DB_CALL = /supabaseAdmin\s*\.\s*from\s*\(|supabaseAdmin\s*\.\s*rpc\s*\(|supabaseAdmin\s*\.\s*auth\s*\./;

  // EVERY route, not just /api/admin: the rule is about ordering, and it only
  // applies where a handler has both a guard and a database call, so a public
  // route without a guard is simply skipped below.
  const protectedRoutes = routeFiles();

  it('finds routes to check (non-vacuity)', () => {
    expect(protectedRoutes.length).toBeGreaterThan(100);
  });

  it('no handler touches the database before authenticating', () => {
    const offenders: string[] = [];
    for (const route of protectedRoutes) {
      for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
        const body = handlerBody(route.src, method);
        if (body === null) continue;
        const hardAt = body.search(HARD_GUARD);
        const softAt = DENIES.test(body) ? body.search(SOFT_GUARD) : -1;
        const candidates = [hardAt, softAt].filter((i) => i !== -1);
        const guardAt = candidates.length > 0 ? Math.min(...candidates) : -1;
        const dbAt = body.search(DB_CALL);
        if (guardAt === -1 || dbAt === -1) continue; // not gated / no db → other tests
        if (dbAt < guardAt) offenders.push(`${method} ${route.url}`);
      }
    }
    expect(
      offenders,
      'These handlers query or write BEFORE checking authorisation. The guard only\n' +
        'withholds the response — the work already happened, and any write already\n' +
        'landed. Move the auth check to the top of the handler.',
    ).toEqual([]);
  });

  it('the ordering check actually distinguishes the two cases (non-vacuity)', () => {
    const bad = `export async function GET() {
      const { data } = await supabaseAdmin.from('x').select('*');
      const admin = await verifyAdmin();
      if (!admin) return null;
      return data;
    }`;
    const good = `export async function GET() {
      const admin = await verifyAdmin();
      if (!admin) return null;
      const { data } = await supabaseAdmin.from('x').select('*');
      return data;
    }`;
    const order = (src: string) => {
      const b = handlerBody(src, 'GET')!;
      return b.search(DB_CALL) < b.search(HARD_GUARD);
    };
    expect(order(bad)).toBe(true);
    expect(order(good)).toBe(false);

    // And attribution must NOT count as a guard: reading the session to label a
    // record is not the same act as refusing an unauthorised caller.
    const attribution = `export async function POST() {
      const { data } = await supabaseAdmin.from('x').select('*');
      const { data: { user } } = await supabase.auth.getUser();
      return { ...data, donor_id: user?.id ?? null };
    }`;
    const b = handlerBody(attribution, 'POST')!;
    expect(DENIES.test(b), 'no 401/403 → not a guard').toBe(false);
  });
});
