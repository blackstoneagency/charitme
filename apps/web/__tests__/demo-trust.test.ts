import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDemoRow, suppressDemoTrust, suppressDemoTrustAll } from '../lib/demo-trust';

// ─────────────────────────────────────────────────────────────────────────────
// Fabricated "Verified" badges must never reach a public read.
//
// The seed suite used to set `verified = (g % 2 = 0)`, so ~half of every demo
// dataset wore a trust badge it never earned. The seed file is fixed, but seeds
// only govern FUTURE runs — production still serves ~48 such badges on /grants,
// which is in sitemap.ts and therefore indexed. Deleting those rows needs the
// owner; suppressing the badge on read does not, and ships immediately.
// ─────────────────────────────────────────────────────────────────────────────

describe('isDemoRow', () => {
  it('detects the source marker (grants carry source=seed)', () => {
    expect(isDemoRow({ source: 'seed' })).toBe(true);
  });

  // This is the case a source-only check would have missed entirely.
  it('detects a seeded VOLUNTEER row, which has no source column at all', () => {
    expect(isDemoRow({ slug: 'seed-vol-6a5e78d0-1' })).toBe(true);
  });

  it('detects seeded grants and nonprofits by slug prefix', () => {
    expect(isDemoRow({ slug: 'seed-grant-6a63b5ac-120' })).toBe(true);
    expect(isDemoRow({ slug: 'seed-nonprofit-abc-3' })).toBe(true);
  });

  it('does NOT treat real rows as demo', () => {
    expect(isDemoRow({ slug: 'clean-water-for-springfield', source: 'manual' })).toBe(false);
    expect(isDemoRow({ slug: 'seedling-project' })).toBe(false); // "seed" prefix, but not "seed-"
    expect(isDemoRow({})).toBe(false);
  });
});

describe('suppressDemoTrust', () => {
  it('clears a fabricated badge on a demo row', () => {
    expect(suppressDemoTrust({ slug: 'seed-grant-1', verified: true }).verified).toBe(false);
    expect(suppressDemoTrust({ source: 'seed', verified: true }).verified).toBe(false);
  });

  it('NEVER downgrades a genuinely verified organization', () => {
    const real = { slug: 'real-foundation', verified: true };
    expect(suppressDemoTrust(real).verified).toBe(true);
    expect(suppressDemoTrust(real)).toBe(real); // untouched, same reference
  });

  it('leaves every other field intact', () => {
    const row = { slug: 'seed-grant-9', verified: true, title: 'Seed Grant 9', amount_min: 5000 };
    expect(suppressDemoTrust(row)).toMatchObject({ title: 'Seed Grant 9', amount_min: 5000, verified: false });
  });

  it('handles lists, mixing demo and real rows', () => {
    const out = suppressDemoTrustAll([
      { slug: 'seed-grant-1', verified: true },
      { slug: 'real-grant', verified: true },
      { slug: 'seed-vol-2', verified: true },
    ]);
    expect(out.map((r) => r.verified)).toEqual([false, true, false]);
  });
});

// A suppression helper that isn't actually called by the read paths would be
// worthless, so pin the wiring too.
describe('the public read paths actually apply it', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

  it('grants server reads suppress demo trust', () => {
    const src = read('lib/grants-server.ts');
    expect(src).toContain('suppressDemoTrustAll');
    expect(src).toContain('suppressDemoTrust(');
  });

  it('the public grants API suppresses demo trust', () => {
    expect(read('app/api/grants/route.ts')).toContain('suppressDemoTrustAll');
  });

  it('volunteer server reads suppress demo trust — BOTH list and detail', () => {
    const src = read('lib/volunteers-server.ts');
    expect(src).toContain('suppressDemoTrustAll');
    // The detail read was missed on the first pass: the helper was imported but
    // never called, so a seeded opportunity's page still showed the badge.
    expect(src).toContain('suppressDemoTrust(data');
  });

  it('grant projections include the source marker', () => {
    // Without `source` in the projection the grants check would fall back to the
    // slug prefix only — still correct, but the marker should be available.
    expect(read('lib/grants.ts')).toContain('verified,source,');
  });
});
