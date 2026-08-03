import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getCause } from '../lib/causes';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
const page = read('app/success-stories/page.tsx');
const sortSelect = read('app/success-stories/SortSelect.tsx');
const css = read('app/globals.css');

/** Comments stripped, so these measure what RENDERS, not what is explained. */
const code = page.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

describe('no fabricated statistics', () => {
  // The reference asserts 2.3M+ People Helped, 68K+ Lives Transformed, 1,250+
  // Programs Funded, 120+ Countries Reached and 98% Funds to Programs. None is
  // an entity in this schema — "people helped" and "lives transformed" are
  // recorded nowhere — and the country claim is already logged in docs/ as a
  // fabricated statistic this repo shipped once and had to retract.
  it('hardcodes none of the mock FIGURES', () => {
    // ⚠️ Numerals only, deliberately. An earlier version of this list also
    // banned the phrases "Lives Transformed" and "People Helped" — and
    // "Lives Transformed" is half the page's own H1 ("Stories of Hope. Lives
    // Transformed."), so the guard banned the reference's headline. A phrase is
    // not a fabrication; a NUMBER nothing measured is.
    for (const fake of ['2.3M', '68K', '1,250+', '120+', '98%']) {
      expect(code, `mock figure "${fake}" must not reach the page`).not.toContain(fake);
    }
  });

  it('labels the impact tiles with what was actually counted', () => {
    // The other half of the same guard: the numerals cannot be fabricated, and
    // the labels must describe the rows behind them rather than the mock's
    // unmeasurable claims.
    for (const label of ['Stories shared', 'Supporters', 'Raised together', 'Countries reached']) {
      expect(code, `impact tile "${label}" is missing`).toContain(label);
    }
    // "People helped" and "Lives transformed" are recorded nowhere in this
    // schema, so neither may appear as a tile LABEL.
    expect(code).not.toMatch(/l:\s*'(People helped|Lives transformed)'/i);
  });

  it('renders every figure through the measured formatters', () => {
    expect(code).toContain('formatStat(campaigns)');
    expect(code).toContain('formatStat(supporters)');
    expect(code).toContain('formatMoneyStat(raisedCents)');
    expect(code).toContain('formatStat(countries)');
  });

  it('keeps the ONE mock figure that is true, and labels it accurately', () => {
    // PLATFORM_FEE_PERCENT = 0, so the platform's cut really is 0%. The tile
    // says "Platform fee", NOT the mock's "Funds to Programs" — processing fees
    // are real, so the stronger claim would overstate it.
    expect(code).toContain("v: '0%'");
    expect(code).toContain("l: 'Platform fee'");
    expect(code).not.toContain('Funds to Programs');
  });

  it('never coerces a FAILED read to zero', () => {
    // 0 is a publishable answer here ("no stories yet"); "we could not count"
    // is a different claim and must stay distinguishable.
    //
    // ⚠️ Precision matters in the guard as much as in the code. A blanket ban on
    // `?? 0` is WRONG and this test used to carry one: `Number(row.x ?? 0)` is
    // correct — a null column really is 0 when summing — and `countries.count ??
    // 0` is correct once `countries.error` has been checked first. What must
    // never happen is a stat reaching that coercion WITHOUT the error check.
    expect(page).toContain('campaigns: rows === null ? null : rows.length');
    expect(page).toContain('supporters: rows === null ? null : rows.reduce');
    expect(page).toContain('raisedCents: rows === null ? null : rows.reduce');
    expect(page).toContain('countries: countries.error ? null : countries.count ?? 0');
    // …and the null-on-failure source itself.
    expect(page).toContain('const rows = totals.error ? null : totals.data ?? [];');
  });
});

describe('the page is wired to real data', () => {
  it('reads campaigns through the visibility filter, not raw', () => {
    // Without this a private or soft-deleted campaign becomes a public "story".
    expect(page).toContain('applyVisibilityFilters(');
    expect(page).toContain("in('status', ['active', 'completed'])");
  });

  it('bounds every read and survives a missing service-role env', () => {
    // Unbounded, a stalled database holds the whole page open; and
    // `supabaseAdmin` throws on property access when the env is absent, which
    // no error check can see and which 500'd this page before.
    expect((page.match(/boundedQuery\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(page).toContain('} catch {');
    expect(page).toContain('return UNMEASURED;');
  });

  it('caches per filter+sort, not globally', () => {
    // One cache key for every combination would serve whichever filter happened
    // to be requested first to everyone else.
    expect(page).toContain("['success-stories', cause, sort]");
  });
});

describe('the category chips filter for real', () => {
  it('every chip resolves to a cause that exists', () => {
    // A chip pointing at a slug with no cause behind it is a link to a 404.
    const slugs = [...page.matchAll(/^\s+'([a-z-]+)',$/gm)].map((m) => m[1]);
    const causeSlugs = slugs.filter((s) => getCause(s));
    expect(causeSlugs.length, 'no cause slugs found — has STORY_CAUSES moved?').toBeGreaterThan(4);
    for (const slug of causeSlugs) expect(getCause(slug), `${slug} has no cause`).toBeTruthy();
  });

  it('labels each chip with the cause it actually filters to', () => {
    // The mock labels these "Children & Youth", "Shelter & Housing", "Health &
    // Care". The nearest real causes are Youth Development, People in Need and
    // Health & Wellness. A chip labelled one thing that returns another is the
    // same defect as a link that looks filtered and is not — so the label comes
    // from the cause, never from a parallel list of display strings.
    expect(code).toContain('{c.label}');
    for (const invented of ['Children &amp; Youth', 'Shelter &amp; Housing', 'Health &amp; Care']) {
      expect(code).not.toContain(invented);
    }
  });

  it('the filter narrows the query, and sorting keeps the filter', () => {
    expect(page).toContain("listQuery.in('category', [...cause.categories])");
    // The href builder carries `sort`, and SortSelect carries the rest — so
    // neither control silently discards the other, which is exactly what the
    // campaigns list did.
    expect(page).toContain("if (sort !== 'recent') p.set('sort', sort);");
    expect(sortSelect).toContain('new URLSearchParams(params.toString())');
  });

  it('marks the active chip with aria-current, not colour alone', () => {
    expect(code).toContain("aria-current={activeCause?.slug === c.slug ? 'page' : undefined}");
    expect(css).toContain(".ss-chip[aria-current='page']");
  });
});

describe('honest affordances', () => {
  it('renders no donor faces beside the donation count', () => {
    // `donations.anonymous` exists so a donor can give without being shown, and
    // there is no read here that honours it per campaign. The count is real;
    // the faces would be invented or a privacy leak.
    expect(code).not.toMatch(/avatar/i);
    expect(code).toContain('Donations from {s.backers.toLocaleString');
  });

  it('links only to routes that exist', () => {
    // The mock's "Submit a Story" had nowhere to go — sharing a story IS
    // starting a campaign here, and there is no story-submission route.
    expect(code).not.toContain('/submit-story');
    expect(code).not.toContain('/stories/submit');
  });
});

describe('theme safety', () => {
  it('the page body uses tokens, not the mock’s dark palette', () => {
    // The reference is drawn in dark mode. Hardcoding it ships a dark slab into
    // the light theme — how a 2.56:1 light-mode failure reached production.
    const block = css.slice(css.indexOf('.ss-page {'));
    const surfaces = block.slice(0, block.indexOf('/* ── Impact tiles ── */'));
    // The hero is the ONE allowed exception: white-on-photo behind a scrim, so
    // the scrim guarantees contrast rather than the theme. Everything after it
    // must be token-driven.
    const afterHero = block.slice(block.indexOf('.ss-body'), block.indexOf('@media (min-width: 900px)'));
    expect(afterHero).not.toMatch(/#[0-9a-f]{6}/i);
    expect(surfaces).toContain('var(--s1)');
  });

  it('uses the type-scale token rather than a hand-tuned clamp', () => {
    const h1 = css.slice(css.indexOf('.ss-hero-copy h1 {'), css.indexOf('.ss-heart'));
    expect(h1).toContain('font-size: var(--fs-h1);');
  });
});
