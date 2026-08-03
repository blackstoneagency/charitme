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
    // Entries are `['slug', 'icon'],` since the chips gained the reference's
    // glyphs. The `toBeGreaterThan` below is the self-check that keeps this from
    // passing vacuously when the shape changes again — and it earned its keep:
    // it failed loudly on the flat-list → tuple change rather than quietly
    // asserting nothing.
    // ⚠️ Scoped to the STORY_CAUSES block. An unanchored tuple pattern also
    // matched `.in('status', ['active', 'completed'])` and then asserted that
    // "active" was a cause — a guard that fails on unrelated code is a guard
    // people learn to edit around.
    const start = page.indexOf('const STORY_CAUSES');
    expect(start, 'STORY_CAUSES not found').toBeGreaterThan(-1);
    const block = page.slice(start, page.indexOf('] as const;', start));
    const slugs = [...block.matchAll(/\['([a-z-]+)',\s*'[a-z]+'\]/g)].map((m) => m[1]);
    expect(slugs.length, 'no cause slugs found — has STORY_CAUSES moved?').toBeGreaterThan(4);
    for (const slug of slugs) expect(getCause(slug), `${slug} has no cause`).toBeTruthy();
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

describe('the server page imports no VALUE from a client module', () => {
  // ⚠️ This is the guard for a production-only 500 that everything else missed.
  //
  // `SORTS` was exported from `SortSelect.tsx`, a 'use client' module, and the
  // server page imported it. Next replaces a client module with a
  // client-reference proxy on the server: the COMPONENT export is usable (as a
  // reference to render), but a plain `const` is not a real value there. The
  // page typechecked, linted, built, and passed a source-reading suite — then
  // died with `SORTS.some is not a function` on the first real request.
  //
  // Only a browser hitting the built page caught it, which is exactly why the
  // browser sweep is not optional.
  const clientModules = ['app/success-stories/SortSelect.tsx'];

  it('every client module the page imports gives it only the component', () => {
    for (const mod of clientModules) {
      expect(read(mod), `${mod} must be a client module for this to apply`).toContain("'use client'");
      const spec = mod.split('/').pop()!.replace('.tsx', '');
      const importLine = new RegExp(`import\\s+([^;]+?)\\s+from\\s+'\\./${spec}'`);
      const m = importLine.exec(page);
      expect(m, `page does not import ${spec}`).not.toBeNull();
      // A default import alone. `{ … }` here means a named export is crossing
      // the server/client boundary as a value.
      expect(
        m![1],
        `the page imports a NAMED export from the client module ${spec} — move it ` +
          'to a non-client module (see lib/story-sort.ts)',
      ).not.toMatch(/[{}]/);
    }
  });

  it('the shared sort constants live in a non-client module', () => {
    const shared = read('lib/story-sort.ts');
    // Comments stripped: this file's doc block EXPLAINS the 'use client'
    // boundary that made the constant unusable on the server, and matching the
    // prose instead of the directive would punish the explanation — the same
    // mistake the fabricated-figure and gradient guards were both bitten by.
    const sharedCode = shared.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    expect(sharedCode).not.toContain("'use client'");
    expect(shared).toContain('export const SORTS');
    expect(shared).toContain('export const SORT_ORDER');
    expect(shared).toContain('export function isSortValue');
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

  it('the hero paints its own dark background, not just a ::before scrim', () => {
    // ⚠️ This is the guard for a REAL light-mode failure that shipped in this
    // very file, under a comment claiming the opposite.
    //
    // The hero's copy is white and the dark field behind it was painted only by
    // `.ss-hero::before`. A pseudo-element is not an ancestor background —
    // nothing resolves white-on-::before as anything but white on whatever the
    // real ancestor is. In LIGHT mode that is the white page, so
    // `audit:contrast` measured the H1, the lede, the breadcrumb and the
    // secondary button at **1:1**. Dark mode passed only by accident, because
    // the page behind it happens to be black.
    //
    // The invariant: any block committing to light-on-dark in BOTH themes must
    // own its background colour, so the contrast is real rather than incidental
    // and survives the photo or the gradient failing to arrive.
    const hero = css.slice(css.indexOf('.ss-hero {'), css.indexOf('.ss-hero-photo'));
    expect(hero, '.ss-hero must set its own background colour').toMatch(/background:\s*#[0-9a-f]{6}/i);
  });

  it('uses the type-scale token rather than a hand-tuned clamp', () => {
    const h1 = css.slice(css.indexOf('.ss-hero-copy h1 {'), css.indexOf('.ss-heart'));
    expect(h1).toContain('font-size: var(--fs-h1);');
  });
});
