import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLATFORM_FEE_PERCENT } from '@shared/fees';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/impact/page.tsx');
const data = read('lib/impact-overview.ts');
/** Comments stripped: the files EXPLAIN the rejected figures, and an assertion
 *  about their absence must not be satisfied — or defeated — by prose. */
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const pageCode = strip(page);
const dataCode = strip(data);

// ─────────────────────────────────────────────────────────────────────────────
// /impact — the reference is dense with figures, and most of them are not
// entities in this schema.
//
// "2.3M+ People Helped" and "68K+ Lives Transformed": nothing records a person
// helped or a life transformed — no table, column or event either could be
// counted from. This repo has already shipped and retracted one fabricated
// platform statistic (recorded in `docs/`), which is why this is a test and not
// a code comment.
//
// The donut reading "Programs & Services 82% / Fundraising 10% / Operations 6%"
// is worse than a made-up headline: it is a FINANCIAL DISCLOSURE about how
// CharitMe spends money, and no such accounting exists in this product.
//
// The three named beneficiaries — the Rahman family, Priya, Arjun — would be
// written by us and presented as real people's outcomes. Same call as the
// "Jessica M." donor quote refused on /campaigns.
// ─────────────────────────────────────────────────────────────────────────────

describe('/impact states no figure it cannot measure', () => {
  it('does not print the invented headline statistics', () => {
    for (const claim of ['2.3M', '68K', 'People Helped', 'Lives Transformed']) {
      expect(pageCode, `"${claim}" is not derivable from any table`).not.toContain(claim);
    }
  });

  it('does not publish a fabricated spending breakdown', () => {
    // The reference's 82/10/6/2 split. There is no operations or fundraising
    // ledger to read it from.
    for (const claim of ['82%', 'Fundraising', 'Operations']) {
      expect(pageCode, `"${claim}" would be a financial disclosure we cannot support`)
        .not.toContain(claim);
    }
  });

  it('does not name a beneficiary who does not exist', () => {
    for (const name of ['Rahman', 'Priya', 'Arjun']) {
      expect(pageCode, `"${name}" would be a fabricated testimonial`).not.toContain(name);
    }
  });

  it('derives the to-campaign share from the fee constant, never a literal', () => {
    // The reference says 98%. The truth is better — the platform fee is 0% — but
    // typing "100" would go stale silently the day that changes.
    expect(dataCode).toMatch(/100 - PLATFORM_FEE_PERCENT/);
    expect(pageCode, 'the page must read the computed value').toContain('toCampaignPercent');
    expect(pageCode, 'no hardcoded percentage').not.toMatch(/\b98%/);
    // Guards the premise: if a platform fee is ever introduced, this test tells
    // the next reader why the tile changed rather than looking like a typo.
    expect(PLATFORM_FEE_PERCENT).toBe(0);
  });

  it('never renders a missing figure as zero', () => {
    // The house rule: `null` is "we could not read it", and 0 is a measurement.
    // On a page whose whole subject is impact, a false 0 is the worst possible
    // rounding.
    expect(pageCode).toMatch(/value \?\? '—'/);
    expect(dataCode, 'unmeasured causes are excluded, not sorted as zero')
      .toMatch(/filter\(\(a\) => a\.raisedCents !== null && a\.raisedCents > 0\)/);
  });

  it('ranks impact areas by measured money rather than an editorial order', () => {
    expect(dataCode).toMatch(/sort\(\(a, b\) =>/);
    expect(dataCode).toMatch(/perCause\.get\(cause\.slug\)/);
  });

  it('builds areas from the shared cause list, not a local copy', () => {
    expect(dataCode).toMatch(/\bCAUSES\b/);
    expect(dataCode).not.toMatch(/const\s+\w*(?:AREAS|CATEGORIES)\w*\s*=\s*\[\s*\{/);
  });

  it('uses the wired subscribe component instead of a second form', () => {
    expect(pageCode).toContain('StayInformed');
    expect(pageCode, 'a bare form here would post nowhere').not.toMatch(/<form[\s>]/);
  });

  it('the stories row shows real published reports', () => {
    expect(pageCode).toContain('listPublishedImpactSummaries');
  });
});

describe('the /impact hero keeps dark mode black', () => {
  const css = read('app/globals.css');

  it('the hero paints its own surface and never the page', () => {
    const from = css.indexOf('.imp-hero {');
    expect(from, 'the hero rule must exist').toBeGreaterThan(-1);
    const block = css.slice(from, css.indexOf('.imp-stats {'));
    expect(block).toContain('background:');
    expect(block, 'a band that sets body/html background is how flat black broke before')
      .not.toMatch(/\b(body|html)\s*\{/);
  });

  it('its photo is scrimmed, because the cover is arbitrary', () => {
    const from = css.indexOf('.imp-hero-art { display: block;');
    expect(from).toBeGreaterThan(-1);
    expect(css.slice(from, from + 600)).toMatch(/::after[\s\S]*?linear-gradient/);
  });
});
