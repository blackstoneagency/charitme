import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  columnPresence,
  shouldFilter,
  isCacheable,
  UNDEFINED_COLUMN,
} from '../lib/campaign-visibility-core';

// ─────────────────────────────────────────────────────────────────────────────
// This is the filter that keeps private and soft-deleted campaigns off public
// listings, so its failure mode matters more than its happy path.
//
// The probe asks whether `campaigns.visibility` exists. The original code read
// `{ visibility: !v.error }` — ANY error meant "column absent" — and cached that
// for the life of the process. A single transient failure (timeout, blip, rate
// limit) on the first call after a cold start therefore disabled
// `visibility = 'public'` and `deleted_at IS NULL` on every public listing until
// the serverless instance recycled.
//
// Latent, not live: verified against production, both columns exist and there are
// currently 0 non-public and 0 soft-deleted campaigns, so nothing was exposed.
// The direction of the failure is still wrong for a privacy filter.
// ─────────────────────────────────────────────────────────────────────────────

describe('columnPresence only calls a column absent with proof', () => {
  it('no error means the column is there', () => {
    expect(columnPresence(null)).toBe('present');
    expect(columnPresence(undefined)).toBe('present');
  });

  it('recognises Postgres undefined_column', () => {
    // Confirmed against the live API: selecting a bogus column returns 42703.
    expect(columnPresence({ code: UNDEFINED_COLUMN })).toBe('absent');
    expect(UNDEFINED_COLUMN).toBe('42703');
  });

  it('falls back to the message when no code is carried', () => {
    expect(columnPresence({ message: 'column campaigns.visibility does not exist' })).toBe('absent');
  });

  it('treats every other failure as UNKNOWN, never absent', () => {
    // These are the shapes that used to silently disable the privacy filter.
    for (const error of [
      { code: '57014', message: 'canceling statement due to statement timeout' },
      { code: 'PGRST301', message: 'JWT expired' },
      { code: '08006', message: 'connection failure' },
      { code: '429', message: 'Too Many Requests' },
      { message: 'fetch failed' },
      {},
    ]) {
      expect(columnPresence(error), JSON.stringify(error)).toBe('unknown');
    }
  });
});

describe('the failure direction favours privacy', () => {
  it('applies the filter unless the column is proven absent', () => {
    expect(shouldFilter('present')).toBe(true);
    expect(shouldFilter('unknown')).toBe(true);
    expect(shouldFilter('absent')).toBe(false);
  });

  it('never caches an unknown answer', () => {
    // Caching `unknown` is the original bug: one blip, filter off until recycle.
    expect(isCacheable('present')).toBe(true);
    expect(isCacheable('absent')).toBe(true);
    expect(isCacheable('unknown')).toBe(false);
  });

  it('a timeout leaves the filter ON and uncached', () => {
    const presence = columnPresence({ code: '57014', message: 'statement timeout' });
    expect(shouldFilter(presence)).toBe(true);
    expect(isCacheable(presence)).toBe(false);
  });
});

describe('the caller wires the decision correctly', () => {
  // Comments blanked: the doc comment quotes the old `{ visibility: !v.error }`
  // to explain what changed, and the assertions below say "this shape is gone".
  const src = readFileSync(join(__dirname, '../lib/campaign-visibility.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ');

  it('no longer derives presence from a bare truthiness check', () => {
    expect(src).not.toMatch(/visibility:\s*!v\.error/);
    expect(src).not.toMatch(/deletedAt:\s*!d\.error/);
  });

  it('uses the proof-based helpers', () => {
    expect(src).toContain('columnPresence(');
    expect(src).toContain('shouldFilter(');
    expect(src).toContain('isCacheable(');
  });

  it('caches only when both answers are definitive', () => {
    expect(src).toMatch(/if \(isCacheable\(visibility\) && isCacheable\(deletedAt\)\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The probe had no deadline, and the "only cache a definitive answer" rule made
// that expensive: an unreachable database is never a definitive answer, so it
// re-probed on EVERY request forever. Measured on a production build against an
// unreachable host, the probe alone cost ~7.05s per request, and 13 public
// routes came to ~14.1s once their own read was added on top.
//
// Bounding it is only safe if the timeout answer fails the SAME direction the
// unknown answer already fails: both filters ON. A page rendering slowly is a
// performance bug; a page listing private campaigns because a probe timed out is
// a privacy breach.
// ─────────────────────────────────────────────────────────────────────────────
describe('the visibility probe is bounded, and its timeout fails toward privacy', () => {
  const src = readFileSync(join(__dirname, '..', 'lib', 'campaign-visibility.ts'), 'utf8');

  it('gives the probe an explicit deadline', () => {
    expect(src, 'the probe can stall without bound').toMatch(/PROBE_TIMEOUT_MS/);
    expect(src).toMatch(/withQueryTimeout\(/);
  });

  it('the timeout fallback applies BOTH filters', () => {
    // The literal must be true/true. A `false` here would publicly list private
    // and soft-deleted campaigns whenever the database was merely slow.
    expect(src).toMatch(
      /FAIL_TOWARD_PRIVACY:\s*CampaignCols\s*=\s*\{\s*visibility:\s*true,\s*deletedAt:\s*true\s*\}/,
    );
  });

  it('does not cache the timeout answer', () => {
    // Caching a guess would freeze it in for the life of the process — the exact
    // defect the unknown-error path was already written to avoid.
    const guard = src.indexOf('if (probe.degraded');
    const ret = src.indexOf('return FAIL_TOWARD_PRIVACY', guard);
    expect(guard).toBeGreaterThan(-1);
    expect(ret).toBeGreaterThan(guard);
    expect(
      src.slice(guard, ret),
      'the degraded path assigns the module-level cache',
    ).not.toMatch(/_campaignCols\s*=/);
  });
});
