import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// An UNAUTHENTICATED API route must not hand the database's own error message
// back to the caller.
//
// A PostgREST/Postgres `error.message` is written for an operator, not a
// stranger: it carries table names, column names, constraint names, and for
// uniqueness violations sometimes the offending value. On a route that only
// rate-limits by IP, that is schema disclosure to anyone who can send a request.
//
// Two routes were doing exactly this — /api/ai/donation-impact and
// /api/ai/donor-conversion, both plain `GET`s behind nothing but
// `checkRateLimitDurable`. They now log the detail server-side and return the
// repo's standard opaque `{ error: 'Internal server error', code:
// 'INTERNAL_ERROR' }`.
//
// Scope note, deliberately narrow: this checks routes with NO auth helper at
// all. Admin-gated routes that echo a DB message are a much weaker concern (the
// caller already holds admin) and are left alone rather than swept up in a rule
// that would then be too noisy to keep.
// ─────────────────────────────────────────────────────────────────────────────

const API = join(__dirname, '..', 'app', 'api');

const AUTH =
  /\b(requireAdmin|verifyAdmin|guardAdmin|guardSuperAdmin|requireSuperAdmin|requireUser|isAdmin|assertAdmin|auth\.getUser|getUser\(\))/;

/** `{ error: someError.message }` handed straight to NextResponse.json. */
const LEAK = /NextResponse\.json\(\s*\{\s*error\s*:\s*(\w*(?:[Ee]rr|[Ee]rror)\w*)\.message/g;

function routes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) routes(p, out);
    else if (e === 'route.ts') out.push(p);
  }
  return out;
}

export function findDisclosures(files: string[]): string[] {
  const bad: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (AUTH.test(src)) continue; // authenticated — out of scope, see header
    for (const m of src.matchAll(LEAK)) {
      bad.push(`${file.slice(file.indexOf('app/api'))}:${src.slice(0, m.index).split('\n').length}`);
    }
  }
  return bad;
}

describe('unauthenticated API routes do not disclose database errors', () => {
  const files = routes(API);

  it('scans a real set of route handlers', () => {
    // Guards against the sweep silently finding nothing and passing vacuously.
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => !AUTH.test(readFileSync(f, 'utf8'))).length).toBeGreaterThan(20);
  });

  it('returns an opaque error instead of the database message', () => {
    expect(
      findDisclosures(files),
      'This route has no auth helper, so `error.message` goes to any caller. Log the detail and return { error: "Internal server error", code: "INTERNAL_ERROR" }.',
    ).toEqual([]);
  });

  it('detects a planted disclosure (the rule is not vacuous)', () => {
    // Exercised against a synthetic source rather than a real file so the check
    // itself is proven to fire without mutating the repo.
    const planted = `import { NextResponse } from 'next/server';
export async function GET() {
  const { data, error } = await supabaseAdmin.from('campaigns').select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}`;
    expect([...planted.matchAll(LEAK)]).toHaveLength(1);
    expect(AUTH.test(planted), 'the planted sample must count as unauthenticated').toBe(false);
  });

  it('does not flag the same shape once the route is authenticated', () => {
    const gated = `export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
}`;
    expect(AUTH.test(gated)).toBe(true);
  });
});
