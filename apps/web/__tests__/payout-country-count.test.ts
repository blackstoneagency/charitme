import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// /fast-payouts hardcoded "40+ Countries" in three places while
// /supported-countries rendered the real figure from `supported_countries` —
// measured 15 able to fundraise. Two pages, two answers to one factual
// question, and the hardcoded one is the one a visitor cannot check.
//
// ⚠️ The rendered check alone is NOT sufficient here. The audit stub does not
// support `head: true` count queries, so the reader returns null and the tile
// is (correctly) omitted — which is exactly what a reader that ALWAYS returned
// null would look like. These assertions cover the branch a live database
// takes, which no local render can exercise.
// ─────────────────────────────────────────────────────────────────────────────

const WEB = path.join(__dirname, '..');
const reader = readFileSync(path.join(WEB, 'lib', 'payout-countries.ts'), 'utf8');
const page = readFileSync(path.join(WEB, 'app', 'fast-payouts', 'page.tsx'), 'utf8');
const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the payout country count is measured, not asserted', () => {
  it('reads the same table and filters that /supported-countries does', () => {
    expect(reader).toContain("from('supported_countries')");
    // Payout capability is can_fundraise; can_donate is the other direction and
    // a larger set — conflating them is part of how the two pages disagreed.
    expect(reader).toContain("eq('active', true)");
    expect(reader).toContain("eq('can_fundraise', true)");
  });

  it('returns null rather than 0 when the read fails', () => {
    // A failed read and "we support nowhere" are opposite statements, and this
    // page exists to convince an organizer they will be paid.
    expect(reader).toMatch(/if \(error\) return null/);
    expect(reader).toMatch(/return count \?\? null/);
    // supabaseAdmin throws on property access when its env is unset, which
    // escapes an `if (error)` check entirely.
    expect(reader).toMatch(/catch \{[\s\S]{0,200}?return null/);
    expect(reader).not.toMatch(/count \?\? 0/);
  });

  it('no longer states a country figure the page cannot verify', () => {
    expect(code, '"40+" was a claim about Stripe coverage shown as CharitMe\'s').not.toContain('40+');
  });

  it('omits the tile entirely when the count is unknown', () => {
    // Not "0 Countries" — that is a false statement, and worse than one fewer
    // tile on this particular page.
    expect(code).toMatch(/payoutCountries !== null/);
    expect(code).toContain('buildStats');
  });

  it('still renders the other three stat tiles', () => {
    for (const label of ['Standard payout', 'Standard speed', 'Same-day fee']) {
      expect(code, `${label} tile lost`).toContain(label);
    }
  });
});
