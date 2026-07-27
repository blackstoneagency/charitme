import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../app/campaigns/(list)/page.tsx'),
  'utf8',
);

// Regression: the location filter interpolated user input straight into an ilike
// pattern while applyCampaignSearch, one line below, stripped SQL LIKE wildcards.
// A location of "%" therefore matched every campaign and "N_w York" matched
// "New York".
describe('location filter strips LIKE wildcards', () => {
  it('sanitises before interpolating', () => {
    expect(SRC, 'must strip % and _ from the location term')
      .toMatch(/replace\(\/\[%_\]\/g/);
  });

  it('does not interpolate the raw value', () => {
    expect(SRC).not.toMatch(/ilike\('location', `%\$\{opts\.location\}%`\)/);
  });

  it('drops a location that was entirely wildcards', () => {
    // "%" alone must not become an unfiltered match-all.
    expect(SRC).toMatch(/if \(safeLocation\)/);
  });
});
