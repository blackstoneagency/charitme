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
