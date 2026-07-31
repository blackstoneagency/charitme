import { describe, it, expect } from 'vitest';
import { compare } from '../scripts/lib/supabase-stub-compare.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// The stub's ordered comparison, guarded because getting it wrong is INVISIBLE.
//
// It was `Number(value) >= Number(raw)`, which is right for amounts and silently
// wrong for timestamps: `Number('2026-07-28T00:00:00Z')` is NaN and every NaN
// comparison is false, so `created_at=gte.<cutoff>` matched zero rows. Any page
// with a date window rendered EMPTY against the stub while working in
// production — and an empty page still has contrast, still returns 200, and
// still passes a smoke sweep. It shrinks audit coverage without reporting
// anything, which is the one failure mode the stub's own header says it must
// not have.
//
// It surfaced only because a leaderboard period query returned 0 campaigns from
// fixtures containing 35 matching donations. Nothing else would have caught it,
// hence this test.
// ─────────────────────────────────────────────────────────────────────────────

describe('supabase-stub ordered comparison', () => {
  it('compares numbers numerically, not as strings', () => {
    // The string trap: '9' > '10' lexicographically.
    expect(compare(9, 10)).toBeLessThan(0);
    expect(compare('100', '20')).toBeGreaterThan(0);
    expect(compare(5, 5)).toBe(0);
  });

  it('compares ISO timestamps chronologically', () => {
    const older = '2026-01-01T00:00:00.000Z';
    const newer = '2026-07-28T00:00:00.000Z';
    expect(compare(newer, older)).toBeGreaterThan(0);
    expect(compare(older, newer)).toBeLessThan(0);
    expect(compare(newer, newer)).toBe(0);
  });

  it('admits rows at or after a cutoff — the case that was returning nothing', () => {
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const withinWindow = new Date(Date.now() - 86_400_000).toISOString();
    const beforeWindow = new Date(Date.now() - 30 * 86_400_000).toISOString();

    // `gte` is `compare(...) >= 0`.
    expect(compare(withinWindow, cutoff) >= 0).toBe(true);
    expect(compare(beforeWindow, cutoff) >= 0).toBe(false);
  });

  it('never returns NaN-driven false for both directions of the same pair', () => {
    // The signature of the original bug: neither a >= b nor a < b held, because
    // both were NaN comparisons. Exactly one must be true for any pair.
    const a = '2026-07-28T00:00:00.000Z';
    const b = '2026-07-01T00:00:00.000Z';
    expect((compare(a, b) >= 0) !== (compare(a, b) < 0)).toBe(true);
  });

  it('orders null and empty as strings rather than collapsing to zero', () => {
    // `Number(null)` is 0 and `Number('')` is 0, so the numeric path would have
    // treated a null timestamp as the epoch and silently ranked it.
    expect(compare(null, '2026-01-01T00:00:00.000Z')).toBeLessThan(0);
    expect(compare('', '2026-01-01T00:00:00.000Z')).toBeLessThan(0);
  });
});
