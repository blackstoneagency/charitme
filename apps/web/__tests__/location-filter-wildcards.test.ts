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
    expect(SRC, 'must route the location term through the shared likeTerm helper')
      .toMatch(/likeTerm\(/);
  });

  it('does not interpolate the raw value', () => {
    expect(SRC).not.toMatch(/ilike\('location', `%\$\{opts\.location\}%`\)/);
  });

  it('drops a location that was entirely wildcards', () => {
    // "%" alone must not become an unfiltered match-all.
    expect(SRC).toMatch(/if \(safeLocation\)/);
  });

  it('every interpolated ilike in the app routes through likeTerm', () => {
    // Four call sites had this shape and only one escaped correctly. A shared
    // helper is the fix; this stops a fifth copy diverging again.
    const files = [
      '../app/api/campaigns/route.ts',
      '../lib/sponsorships.ts',
      '../lib/matching.ts',
    ];
    for (const f of files) {
      const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), f), 'utf8');
      expect(src, `${f} must escape its ilike term`).toMatch(/likeTerm\(/);
      expect(src, `${f} must not interpolate a raw search value`)
        .not.toMatch(/ilike\('(location|title|company_name)', `%\$\{(location|filters\.search|search)\}%`\)/);
    }
  });
});
