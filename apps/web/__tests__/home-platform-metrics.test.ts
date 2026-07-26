import { describe, expect, it } from 'vitest';
import { shouldShowPlatformMetrics } from '../lib/home-utils';

// ─────────────────────────────────────────────────────────────────────────────
// The homepage must never publish a platform statistic it did not read.
//
// `getHomeData` does not throw when its reads fail — it coalesces each to `[]` and
// returns a fully-zeroed metrics object — so a failed load is indistinguishable
// from real zeros at the call site. Guarding on the try/catch alone shipped
// "Raised on CharitMe $0" onto the homepage of a credential-less production build.
//
// These tests pin both directions: never invent numbers, and never silently
// suppress real ones (a guard that always returns false would "fix" the bug by
// deleting the feature, and would otherwise go unnoticed).
// ─────────────────────────────────────────────────────────────────────────────

const REAL = { raisedCents: 4_250_000, campaigns: 128, donations: 3_400 };
const ZEROS = { raisedCents: 0, campaigns: 0, donations: 0 };

describe('shouldShowPlatformMetrics', () => {
  it('shows real numbers when the load succeeded', () => {
    expect(shouldShowPlatformMetrics(REAL, true)).toBe(true);
  });

  it('hides everything when the load failed', () => {
    expect(shouldShowPlatformMetrics(REAL, false)).toBe(false);
  });

  it('hides an all-zero reading even when the load "succeeded"', () => {
    // The exact regression: no credentials, no throw, all zeros, and the homepage
    // rendered "$0 raised" as though it were a fact about the platform.
    expect(shouldShowPlatformMetrics(ZEROS, true)).toBe(false);
  });

  it.each([
    ['raised only', { raisedCents: 500, campaigns: 0, donations: 0 }],
    ['campaigns only', { raisedCents: 0, campaigns: 3, donations: 0 }],
    ['donations only', { raisedCents: 0, campaigns: 0, donations: 7 }],
  ])('shows when any single metric has data (%s)', (_label, metrics) => {
    // A brand-new platform legitimately has some fields at zero. Partial data is
    // still data, and suppressing it would hide a real launch.
    expect(shouldShowPlatformMetrics(metrics, true)).toBe(true);
  });

  it('ignores trustAvg entirely', () => {
    // trustAvg is an average: it can be 0 with real data present, and non-zero on a
    // stale partial read. Including it in the check would make both cases wrong.
    const withTrustOnly = { raisedCents: 0, campaigns: 0, donations: 0, trustAvg: 92 };
    expect(shouldShowPlatformMetrics(withTrustOnly, true)).toBe(false);
  });

  it('does not treat negative values as data', () => {
    expect(shouldShowPlatformMetrics({ raisedCents: -1, campaigns: -2, donations: -3 }, true)).toBe(false);
  });
});
