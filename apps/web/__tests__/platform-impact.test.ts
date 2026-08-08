import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LIB = readFileSync(join(__dirname, '..', 'lib', 'platform-impact.ts'), 'utf8');
const SEED = readFileSync(
  join(__dirname, '..', '..', '..', 'supabase', 'seed', 'platform_impact.sql'),
  'utf8',
);
const MIGRATION = readFileSync(
  join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260829010000_platform_impact_stats.sql'),
  'utf8',
);

describe('the reader fails toward measured figures, never toward invented ones', () => {
  it('reads only published rows', () => {
    // An unpublished figure is a claim nobody has signed off on. It must not
    // reach a donor deciding where to send money.
    const publishedFilters = LIB.match(/\.eq\('published', true\)/g) ?? [];
    expect(publishedFilters).toHaveLength(2);
  });

  it('returns empty on any error rather than throwing or guessing', () => {
    expect(LIB).toMatch(/if \(error \|\| !data\) return \[\]/);
  });

  it('bounds both queries so a hanging database cannot hang the page', () => {
    expect((LIB.match(/boundedQuery/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('drops rows with an empty value or label instead of rendering a blank tile', () => {
    expect(LIB).toContain('.filter((s) => s.value && s.label)');
  });
});

describe('the donut refuses to draw an incomplete picture', () => {
  it('rejects a set that does not sum to ~100%', () => {
    // A donut reads as "this is ALL of the money". A partial set looks complete
    // and is therefore worse than no chart at all.
    expect(LIB).toContain('Math.abs(total - 100) > 1');
  });

  it('rejects a single slice', () => {
    expect(LIB).toContain('slices.length < 2');
  });

  it('allows one point of rounding, because published accounts round', () => {
    expect(LIB).toMatch(/>\s*1\)/);
  });

  it('drops non-positive or non-finite percentages before summing', () => {
    expect(LIB).toContain('Number.isFinite(s.percent) && s.percent > 0');
  });
});

describe('the seed ships the design values UNPUBLISHED', () => {
  it('carries every headline figure from the reference', () => {
    for (const value of ['2.3M+', '68K+', '1,250+', '120+', '98%']) {
      expect(SEED).toContain(value);
    }
  });

  it('carries the donut segments from the reference', () => {
    for (const slice of ['Programs & Services', 'Fundraising', 'Operations', 'Other']) {
      expect(SEED).toContain(slice);
    }
  });

  it('inserts nothing as published', () => {
    // The whole safety property: running the seed changes nothing a visitor sees.
    expect(SEED).not.toMatch(/,\s*true\s*\)/);
    const falses = SEED.match(/false\)/g) ?? [];
    expect(falses.length).toBeGreaterThanOrEqual(9);
  });

  it('marks every figure as unverified so nobody publishes it by reflex', () => {
    expect(SEED).toContain('UNVERIFIED');
    expect(SEED).toContain('UNVERIFIED FINANCIAL DISCLOSURE');
  });

  it('never silently unpublishes a figure an admin already approved', () => {
    // `on conflict do update` must not reset `published`, or re-running the seed
    // would take live figures off the page.
    const updateClause = SEED.slice(SEED.indexOf('on conflict'));
    expect(updateClause).not.toMatch(/set[\s\S]*published\s*=/);
  });

  it('records that the measured funds figure BEATS the design claim', () => {
    // The platform fee is 0%, so "98% to programs" understates reality. Worth
    // saying in the seed so nobody publishes a worse number than the truth.
    expect(SEED).toContain('platform fee is 0%');
  });
});

describe('the migration keeps the two claims separable', () => {
  it('creates both tables', () => {
    expect(MIGRATION).toContain('create table if not exists public.platform_impact_stats');
    expect(MIGRATION).toContain('create table if not exists public.platform_fund_allocation');
  });

  it('defaults both to unpublished', () => {
    const defaults = MIGRATION.match(/published\s+boolean\s+not null default false/g) ?? [];
    expect(defaults).toHaveLength(2);
  });

  it('exposes only published rows to anonymous readers', () => {
    const readPolicies = MIGRATION.match(/for select\s+using \(published = true\)/g) ?? [];
    expect(readPolicies).toHaveLength(2);
  });

  it('restricts writes to admins on both tables', () => {
    // This asserted `role in ('admin', 'super_admin')` and so PINNED THE BUG:
    // `profiles.role` is dropped by 20260828000000, and the predicate raises
    // 42703 on a database provisioned from scratch. The test passed because it
    // matched the migration's text, not because the migration worked. It now
    // asserts the hardened predicate, and that the dropped column is gone.
    const adminWrites = MIGRATION.match(/using \(public\.is_admin\(\)\)/g) ?? [];
    expect(adminWrites.length, 'both tables need an is_admin() USING clause').toBe(2);
    expect(MIGRATION.match(/with check \(public\.is_admin\(\)\)/g) ?? []).toHaveLength(2);
    // Comments may discuss the old shape; a live predicate may not use it.
    const sql = MIGRATION.replace(/--[^\n]*/g, '');
    expect(sql, 'migration still reads the dropped profiles.role').not.toMatch(/\.role\s+in\s*\(/i);
  });

  it('keeps one row per slot so a duplicate cannot add a sixth tile', () => {
    const uniques = MIGRATION.match(/unique \(sort_order\)/g) ?? [];
    expect(uniques).toHaveLength(2);
  });

  it('constrains percent to a real percentage', () => {
    expect(MIGRATION).toContain('percent >= 0 and percent <= 100');
  });

  it('demands provenance on both tables', () => {
    const notes = MIGRATION.match(/source_note text/g) ?? [];
    expect(notes).toHaveLength(2);
  });
});
