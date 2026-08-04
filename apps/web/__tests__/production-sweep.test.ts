import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PUBLIC_API,
  MUST_HAVE_ROWS,
  MUST_BE_GATED,
  causeSlugs,
} from '../scripts/sweep-production-routes.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// `scripts/sweep-production-routes.mjs` is the only check in this repo that
// exercises production with a REAL database behind it. Every browser audit
// drives a local build with no Supabase credentials, where `supabaseAdmin` is a
// Proxy that throws on access — so a route that 500s only when a real query runs
// is invisible to all of them. That is how a 500 on `/causes/mental-health`
// reached production underneath a passing audit suite.
//
// These tests run OFFLINE. They check the catalogue, not the site: the script
// only makes requests when invoked directly.
// ─────────────────────────────────────────────────────────────────────────────

const publicApi = PUBLIC_API as string[];
const mustHaveRows = MUST_HAVE_ROWS as Record<string, string>;
const mustBeGated = MUST_BE_GATED as string[];

describe('the production sweep catalogue', () => {
  it('never lists a route as both public and gated', () => {
    // The two expectations are opposites — 200 is a pass in one list and a
    // security failure in the other, so an overlap makes the sweep incoherent.
    const both = publicApi.filter((p) => mustBeGated.includes(p));
    expect(both, 'a route cannot be both publicly readable and required to refuse').toEqual([]);
  });

  it('only asserts row counts for routes it actually requests', () => {
    const orphaned = Object.keys(mustHaveRows).filter((p) => !publicApi.includes(p));
    expect(
      orphaned,
      'MUST_HAVE_ROWS names a route missing from PUBLIC_API, so the assertion never runs',
    ).toEqual([]);
  });

  it('every gated route is an admin or cron path', () => {
    // Guards against someone "fixing" a sweep failure by moving a genuinely
    // public route into the gated list, which would invert its expectation and
    // hide a real regression.
    const wrong = mustBeGated.filter((p) => !/^\/api\/(admin|cron)\//.test(p));
    expect(wrong, 'only admin/cron routes should be required to refuse anonymous callers').toEqual([]);
  });

  it('every catalogued route exists as a handler on disk', () => {
    // A renamed route would otherwise sweep a 404 forever and report it as fine,
    // because only 5xx counts as a page failure.
    for (const route of [...publicApi, ...mustBeGated]) {
      const dir = join(__dirname, '..', 'app', route.replace(/^\//, ''));
      expect(() => readFileSync(join(dir, 'route.ts'), 'utf8'), `${route} has no route.ts`).not.toThrow();
    }
  });

  it('reads cause slugs from lib/causes.ts rather than a copy', () => {
    // The single-source-of-truth rule: a hardcoded list here would silently stop
    // covering a cause the day someone adds one.
    const slugs = causeSlugs();
    expect(slugs.length).toBeGreaterThan(10);
    const src = readFileSync(join(__dirname, '..', 'lib', 'causes.ts'), 'utf8');
    for (const s of slugs) expect(src).toContain(`'${s}'`);
  });

  it('makes no request on import', () => {
    // The whole file is imported above. If it fired HTTP at module scope, this
    // suite would hit production on every `npm test`.
    const src = readFileSync(join(__dirname, '..', 'scripts', 'sweep-production-routes.mjs'), 'utf8');
    expect(src, 'main() must stay behind the invokedDirectly guard').toMatch(/if \(invokedDirectly\)/);
    expect(src.split('const invokedDirectly')[0]).not.toMatch(/^\s*await main\(/m);
  });
});
