import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asFileList } from '../lib/campaign-media-core';

// ─────────────────────────────────────────────────────────────────────────────
// Regression: `/campaigns/[slug]/gallery` answered HTTP 500 on a public route.
//
//   TypeError: c?.some is not a function
//
// The cause was `data?.some(...)` on a Supabase Storage `list()` result.
// Optional chaining guards `null` and `undefined` — it does NOT guard a value of
// the wrong TYPE. When `list()` returned a non-array, the call threw, and the
// module broke its own documented contract of "returns null on ANY failure".
//
// Found by the signed-in mobile sweep, which reports a non-200 rather than
// skipping it — the audit refusing to measure is what surfaced the bug.
// ─────────────────────────────────────────────────────────────────────────────

describe('asFileList', () => {
  it('passes a real listing through', () => {
    const rows = [{ name: 'a.webp', id: '1', metadata: { size: 10 } }];
    expect(asFileList(rows)).toEqual(rows);
  });

  it('returns an empty list for null and undefined', () => {
    expect(asFileList(null)).toEqual([]);
    expect(asFileList(undefined)).toEqual([]);
  });

  it('returns an empty list for a NON-ARRAY — the case that caused the 500', () => {
    // Each of these makes `data?.some` throw. None of them may now.
    expect(asFileList({})).toEqual([]);
    expect(asFileList({ error: 'nope' })).toEqual([]);
    expect(asFileList('a string')).toEqual([]);
    expect(asFileList(42)).toEqual([]);
    expect(asFileList(true)).toEqual([]);
  });

  it('the result is always safe to call array methods on', () => {
    // The property the call sites actually depend on.
    for (const value of [null, undefined, {}, 'x', 7, true, []]) {
      expect(() => asFileList(value).some((f) => f.name === 'x')).not.toThrow();
      expect(() => asFileList(value).filter((f) => f.id !== null)).not.toThrow();
    }
  });

  it('no call site in the module reaches for the raw result again', () => {
    // A future `data ?? []` would reintroduce exactly this bug.
    const source = readFileSync(
      join(__dirname, '..', 'lib', 'campaign-media-storage.ts'),
      'utf8',
    );
    expect(source).not.toContain('data ?? []');
    expect(source).not.toContain('data?.some');
  });
});
