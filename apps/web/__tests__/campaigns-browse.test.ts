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

  it('does not ship a tile that cannot filter', () => {
    // ⚠️ The guard's PREMISE changed, so the guard did too — carefully.
    //
    // It used to say: these six labels are not in CAMPAIGN_CATEGORIES, so they
    // must not appear anywhere in the page. That was right while the only
    // filter was `?category=`. The page now also filters by `?cause=`, and a
    // cause maps to SEVERAL categories — which is exactly what a broad label
    // like "Food & Hunger" means.
    //
    // So the real invariant is not "the label is a category". It is "every
    // tile leads somewhere that filters". That is what is asserted now, and it
    // still catches the original bug: a label that is neither a category nor a
    // cause fails here.
    const realCategories = new Set<string>(CAMPAIGN_CATEGORIES);
    const causeSlugs = new Set(
      [...readFileSync(join(__dirname, '..', 'lib/causes.ts'), 'utf8')
        .matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]),
    );
    expect(causeSlugs.size).toBeGreaterThan(15);

    // Every reference tile must name a cause slug that really exists.
    const tiles = [...code.matchAll(/\{ slug: '([a-z0-9-]+)', label: '([^']+)'/g)];
    expect(tiles.length, 'the reference tiles must still be present').toBe(5);
    for (const [, slug, label] of tiles) {
      expect(causeSlugs.has(slug), `tile "${label}" points at cause "${slug}", which does not exist`).toBe(true);
      // And the label is deliberately NOT a category — that is the whole point
      // of routing it through ?cause= instead of ?category=.
      expect(realCategories.has(label)).toBe(false);
    }

    // "Health & Care" is in neither set, so it must still be absent entirely.
    expect(code).not.toContain('Health & Care');
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

describe('the measured figures strip', () => {
  const src = readFileSync(join(__dirname, '..', 'app/campaigns/(list)/page.tsx'), 'utf8');
  const causesSrc = readFileSync(join(__dirname, '..', 'app/causes/page.tsx'), 'utf8');

  it('renders the SAME StatStrip as /causes, not a second implementation', () => {
    // This page and /causes sit one click apart. Two components stating "how
    // many live campaigns are there" is two answers to one question.
    expect(src).toContain("import { StatStrip, statValue, moneyValue }");
    expect(src).toContain('<StatStrip');
    expect(causesSrc).toContain('<StatStrip');
  });

  it('reads the SAME loader as /causes, so the counts cannot disagree', () => {
    expect(src).toContain('getCausesIndexData');
    expect(causesSrc).toContain('getCausesIndexData');
  });

  it('states the same four figures with the same labels', () => {
    for (const label of ['Active campaigns', 'Raised on CharitMe', 'Gifts given', 'Countries supported']) {
      expect(src, `/campaigns tile: ${label}`).toContain(label);
      expect(causesSrc, `/causes tile: ${label}`).toContain(label);
    }
  });

  it('renders an em dash for an unmeasured figure, never a zero', () => {
    // statValue/moneyValue own that rule; asserting the page uses them rather
    // than formatting inline is what keeps it true here.
    expect(src).toContain('statValue(platform.activeCampaigns)');
    expect(src).toContain('moneyValue(platform.raisedTotalCents)');
    expect(src).not.toMatch(/platform\.\w+ \?\? 0/);
  });

  it('hides the strip on a filtered or paginated view', () => {
    // A platform-wide total sitting above a filtered list reads as the count OF
    // that list. `showExtras` is the same flag the featured rail and the donor
    // board already use.
    expect(src).toContain('showExtras ? getCausesIndexData() : Promise.resolve(null)');
    expect(src).toContain('{platform && (');
  });

  it('does not cost a round trip when it will not be shown', () => {
    expect(src).not.toContain('await getCausesIndexData()');
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// The category rail must show EVERY option, always.
//
// It was `display: flex; overflow-x: auto` with fixed 96px tiles. With 24 tiles
// that is a ~2,400px row: on desktop everything past "Environment" sat outside
// the viewport, and on a phone all but three did. A horizontal scroller with no
// affordance is indistinguishable from a rail that simply ends — so those
// filters did not exist as far as a visitor was concerned.
// ─────────────────────────────────────────────────────────────────────────────

describe('every category is visible without horizontal scrolling', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const railCss = () => {
    const at = css.indexOf('.cbx-cats {');
    expect(at, '.cbx-cats rule not found').toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('wraps to multiple rows instead of scrolling sideways', () => {
    expect(railCss()).toMatch(/display: grid/);
    expect(railCss(), 'a sideways scroller hides the tail of the list').not.toMatch(/overflow-x:\s*auto/);
  });

  it('lets the column count follow the viewport', () => {
    // auto-fill means one rule serves a 320px phone and a wide desktop; a fixed
    // column count would need a breakpoint per width and would still overflow
    // somewhere between them.
    expect(railCss()).toMatch(/repeat\(auto-fill, minmax\(96px, 1fr\)\)/);
  });

  it('drops the fixed tile width that forced the overflow', () => {
    const tile = css.slice(css.indexOf('.cbx-cat {'), css.indexOf('}', css.indexOf('.cbx-cat {')));
    expect(tile, 'a fixed width cannot participate in a wrapping grid').not.toMatch(/width: 96px/);
    expect(tile).toMatch(/min-width: 0/);
  });

  it('wraps long labels rather than overflowing the tile', () => {
    // "Shelter & Housing" does not fit one line at 96px.
    const label = css.slice(css.indexOf('.cbx-cat-label {'), css.indexOf('}', css.indexOf('.cbx-cat-label {')));
    expect(label).toMatch(/overflow-wrap: anywhere/);
  });

  it('sizes down on a phone instead of shrinking to three per row', () => {
    const mq = css.slice(css.indexOf('@media (max-width: 480px)', css.indexOf('.cbx-cats {')));
    expect(mq.slice(0, mq.indexOf('\n}'))).toMatch(/\.cbx-cats \{[^}]*minmax\(78px, 1fr\)/);
  });

  it('still renders all 24 tiles: All, the five named ones, and every category', () => {
    // The rail is only "complete" if the markup emits everything the CSS can now
    // lay out. 1 + 5 + CAMPAIGN_CATEGORIES.
    expect(code).toMatch(/REFERENCE_TILES\.map/);
    expect(code).toMatch(/CAMPAIGN_CATEGORIES\.map/);
    expect(code).toMatch(/All Campaigns/);
    expect(CAMPAIGN_CATEGORIES.length, 'the rail lays out 18 + 5 + 1 tiles').toBe(18);
  });
});
