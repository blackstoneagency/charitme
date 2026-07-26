import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/donor/page.tsx'),
  'utf8',
);

// Regression: "Total Given" and "Platform Tips" were reduced over the donations
// array, which is capped at .limit(100) for rendering. A donor with more than 100
// gifts saw an understated lifetime total on their own giving record. "Donations"
// showed donations.length even though the query already asked for count:'exact'.
describe('donor dashboard totals are not computed from the capped list', () => {
  it('money totals come from the dedicated uncapped query', () => {
    expect(SRC, 'totals must not reduce over the paged `donations` array')
      .not.toMatch(/const total(Given|Tips)\s*=\s*donations\s*\n?\s*\.filter/);
    expect(SRC, 'expected a separate allCompleted source').toMatch(/allCompleted/);
  });

  it('the donations tile uses the exact count, not the page size', () => {
    expect(SRC).not.toMatch(/label: 'Donations',\s*value: donations\.length/);
    expect(SRC).toMatch(/donationRes\.count/);
  });

  it('the totals query sets an explicit high limit', () => {
    // PostgREST caps unbounded selects, so omitting a limit would silently
    // reintroduce the same bug at a different threshold.
    expect(SRC).toMatch(/\.limit\(10_000\)/);
  });
});
