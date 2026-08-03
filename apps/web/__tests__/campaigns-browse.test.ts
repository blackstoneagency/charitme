import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

// ─────────────────────────────────────────────────────────────────────────────
// /campaigns — the browse page, rebuilt to the supplied design.
//
// The design's category strip is labelled "Emergency Aid", "Food & Hunger",
// "Shelter & Housing", "Health & Care", "Children & Youth", "Women & Families".
// **None of those exist in `CAMPAIGN_CATEGORIES`**, which is the single source of
// truth and what `campaigns.category` is filtered on. Tiles carrying those labels
// would each land on a page with zero results — navigation that looks right and
// is broken, which is the specific failure this repo keeps having to walk back.
//
// So the strip's TREATMENT is reproduced and its CONTENT comes from the real
// list. Same rule for the "Campaign Type" checkbox group: the design's options
// (Urgent Needs / Long-Term Projects / Rebuilding & Recovery) have no column
// behind them, so the group carries the three filters that are real.
//
// These are source-level assertions because the sandbox has no database — every
// list renders empty here, so a rendered-output test would pass against nothing.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = join(__dirname, '..', 'app', 'campaigns', '(list)', 'page.tsx');
const raw = readFileSync(PAGE, 'utf8');
/** Comments stripped: the file EXPLAINS the rejected labels, and an assertion
 *  that they are absent must not be satisfied — or defeated — by prose. */
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('campaigns browse page is wired to real data', () => {
  it('builds the category strip from the shared list, not a local one', () => {
    expect(code, 'the strip must iterate CAMPAIGN_CATEGORIES').toMatch(
      /CAMPAIGN_CATEGORIES\.map/,
    );
    // Three hand-maintained copies of this list had already drifted apart before
    // it was centralised; a fourth here would be the same bug again.
    expect(code).not.toMatch(/const\s+\w*CATEGORIES\w*\s*=\s*\[/);
  });

  it('does not ship a category tile that cannot filter', () => {
    const invented = [
      'Emergency Aid', 'Food & Hunger', 'Shelter & Housing',
      'Health & Care', 'Children & Youth', 'Women & Families',
    ];
    const real = new Set<string>(CAMPAIGN_CATEGORIES);
    for (const label of invented) {
      expect(real.has(label), `${label} is not a real category — the guard's premise changed`).toBe(false);
      expect(code, `"${label}" would render a tile that returns no campaigns`).not.toContain(label);
    }
  });

  it('compares the goal filter in CENTS, because goal_amount is in cents', () => {
    // A dollar figure against a cents column is the classic way a money filter
    // silently matches everything.
    expect(code).toMatch(/minCents/);
    expect(code).toMatch(/goal_amount['"]?\s*,\s*band\.minCents/);
    expect(code, '$5,000 must be 500_000 cents').toMatch(/500_000/);
  });

  it('every filter control maps to a real query', () => {
    for (const [control, column] of [
      ['verified', "'trust_status'"],
      ['tax', "'nonprofit_verified'"],
      ['ending', "'deadline'"],
    ] as const) {
      expect(code, `${control} must reach ${column}`).toContain(column);
    }
  });

  it('paging and category links carry every active filter', () => {
    // Losing a filter on page 2 is how a visitor ends up on results that do not
    // match the controls still shown as selected.
    //
    // ⚠️ This used to require each `params.set('…')` to appear at least TWICE —
    // once in `pageHref`, once in `catHref`. That was a proxy for "both links
    // carry it", and it only worked because the two were duplicates. The
    // duplication was itself the hazard: adding `?cause=` had to be remembered
    // in both, and was not, so paging silently dropped the cause.
    //
    // There is now ONE builder that both delegate to, which makes every param
    // carried by construction — so the property is asserted directly, and the
    // old count would now FAIL against strictly better code.
    expect(code).toContain('function campaignsHref(');
    expect(code).toMatch(/const pageHref = \(targetPage: number\) => campaignsHref\(/);
    expect(code).toMatch(/const catHref = \(c: string \| null\) => campaignsHref\(/);
    for (const key of ['ending', 'goal', 'verified', 'tax', 'cause']) {
      expect(code, `${key} must be carried by the shared link builder`)
        .toMatch(new RegExp(`params\\.set\\('${key}'`));
    }
    // Exactly one builder. A second `new URLSearchParams()` here is the
    // duplication coming back.
    expect(
      (code.match(/new URLSearchParams\(\)/g) ?? []).length,
      'a second URL builder has appeared — fold it into campaignsHref',
    ).toBe(1);
  });

  it('uses the shared countdown rather than formatting its own', () => {
    expect(code).toMatch(/campaignTimeLabel\(/);
    // The check is on the rendered STRING, not on date arithmetic generally:
    // `getCampaigns` legitimately computes a 30-day bound for the "ending soon"
    // QUERY, which is not a countdown and must not be swept up here.
    // Building the label locally is how "3 days left" and "Ended" once appeared
    // side by side for the same campaign.
    expect(code, 'the countdown string must come from campaignTimeLabel')
      .not.toMatch(/\$\{[^}]*\}\s*days? left/);
    expect(code).not.toMatch(/['"`]\s*days? left['"`]/);
  });

  it('does not read the clock during render', () => {
    // `Date.now()` in a component body is an impure call and fails the build;
    // the helpers apply their own default instead.
    expect(code).not.toMatch(/Date\.now\(\)/);
  });

  it('distinguishes a failed read from an empty catalogue', () => {
    expect(code).toMatch(/unavailable/);
    expect(raw).toMatch(/We couldn't load campaigns just now/);
    expect(raw).toMatch(/No campaigns found/);
  });

  it('does not fabricate the testimonial the design shows', () => {
    // There is no testimonials table, so the quote and the person would both be
    // written by us and presented as a real supporter's words.
    expect(code).not.toMatch(/Jessica/);
    expect(raw, 'the refusal must stay documented so it is not "fixed" later')
      .toMatch(/testimonial/i);
  });

  it('labels the donor panel by what the data actually is', () => {
    // getTopDonors is money GIVEN, not money RAISED. The design says "Top
    // Fundraisers", which would misdescribe every name on the list.
    expect(code).toMatch(/getTopDonors/);
    expect(code).not.toMatch(/Top Fundraisers/);
  });
});

describe('the campaigns page keeps dark mode black', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

  it('the hero band paints its own surface and never the page', () => {
    const block = css.slice(css.indexOf('.cbx-hero {'), css.indexOf('.cbx-cats {'));
    expect(block, 'the hero must exist for this guard to mean anything').toContain('background:');
    // A band that sets a body/html background is exactly how flat black got
    // broken before — dark mode read as a purple banner over a dark page.
    expect(block).not.toMatch(/\b(body|html)\s*\{/);
  });

  it('dark mode still resolves the page background to flat black', () => {
    // Sliced to the rule's own closing brace rather than a fixed character
    // budget — the rule carries a long comment, and a short window made this
    // fail while the code was correct.
    const from = css.indexOf('[data-theme="dark"] body {');
    expect(from, 'the dark body rule must exist').toBeGreaterThan(-1);
    const rule = css.slice(from, css.indexOf('}', from));
    expect(rule).toMatch(/background:\s*#000000/);
    // A gradient here is the exact regression: dark mode read as a purple
    // banner over a dark page.
    expect(rule).not.toMatch(/gradient/);
  });
});
