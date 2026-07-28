import { describe, expect, it } from 'vitest';
import { findMethodMismatches, stats } from '../scripts/audit-fetch-methods.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// A fetch() may target a perfectly valid path with a verb the route does not
// export. Next answers 405 before any route code runs, so nothing throws and
// nothing logs — the feature just silently does nothing. `internal-links` checks
// the PATH only and cannot see this.
//
// HONEST RESULT: this found ZERO real mismatches across 276 call sites. The
// codebase is clean on this dimension; the value here is the regression guard,
// not a bug it caught. Recording that plainly because every audit in this repo
// that reported a clean sweep without saying how it was verified turned out to
// be measuring nothing.
//
// Non-vacuity was checked by planting a mismatch in BOTH forms — a plain
// `method: 'PUT'` and the ternary branch `editing ? 'PATCH' : 'PUT'` — and
// confirming each is reported.
// ─────────────────────────────────────────────────────────────────────────────

describe('every fetch reaches a handler that exports its method', () => {
  it('scans a realistic amount of the app (guards against a vacuous pass)', () => {
    expect(stats.handlers).toBeGreaterThan(150);
    expect(stats.calls).toBeGreaterThan(200);
  });

  it('has no method/route mismatch', () => {
    const problems = findMethodMismatches();
    expect(
      problems,
      'These fetch calls would get a 405 — the path is right, the verb is not.\n' +
        'Either the client is using the wrong method or the route is missing a handler:\n  ' +
        problems.join('\n  '),
    ).toEqual([]);
  });
});
