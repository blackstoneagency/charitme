import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAUSES } from '../lib/causes';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Cause pages show SIX campaigns, then a "See more campaigns" button that loads
// the next six in place.
//
// The button used to be a LINK to /campaigns, and that quietly lost the cause: a
// cause spans several categories while /campaigns filters on ONE, so following
// it showed a different set of campaigns than the page the visitor was reading.
// Loading in place is what keeps the cause intact, which is why the API had to
// learn multi-category filtering first.
// ─────────────────────────────────────────────────────────────────────────────

const page = read('app/causes/[slug]/page.tsx');
const list = read('app/causes/[slug]/CauseCampaignList.tsx');
const api = read('app/api/campaigns/route.ts');
const css = read('app/globals.css');

describe('every cause page shows six campaigns then a button', () => {
  it('renders exactly six before the button', () => {
    expect(page, 'the page size is the whole feature').toMatch(/const PAGE_SIZE = 6;/);
    expect(list).toMatch(/export const CAUSE_PAGE_SIZE = 6;/);
    expect(page, 'only the first six are handed to the list').toMatch(
      /initial=\{campaigns\.slice\(0, PAGE_SIZE\)\}/,
    );
  });

  it('asks for one more row than it renders, so "more" is measured', () => {
    // Without the +1 the button can only appear when the count lands EXACTLY on
    // a page boundary — a cause with 7 campaigns would show 6 and no button.
    expect(page).toMatch(/\.limit\(PAGE_SIZE \+ 1\)/);
    expect(page).toMatch(/hasMore=\{campaigns\.length > PAGE_SIZE\}/);
  });

  it('applies to ALL cause pages, because there is one route for every cause', () => {
    // The goal is "for all cause pages". They are one dynamic route, so this is
    // structural rather than a per-cause sweep — but assert the causes exist and
    // that no cause ships its own bespoke page that would miss the change.
    expect(CAUSES.length).toBeGreaterThan(10);
    for (const cause of CAUSES) {
      expect(cause.categories.length, `${cause.slug} has no categories to query`).toBeGreaterThan(0);
      for (const c of cause.categories) {
        // A category the API will reject would render an empty cause page.
        expect(
          (CAMPAIGN_CATEGORIES as readonly string[]).includes(c),
          `${cause.slug} maps to "${c}", which is not a real campaign category`,
        ).toBe(true);
      }
    }
  });
});

describe('the "see more" fetch keeps the cause intact', () => {
  it('sends every one of the cause\'s categories, not just the first', () => {
    expect(list).toMatch(/category: categories\.join\(','\)/);
  });

  it('the API filters multi-category with `in`, and single with `eq`', () => {
    // Both paths matter: `.in()` is what makes a multi-category cause work, and
    // the `.eq()` path is what keeps every existing single-category caller
    // behaving exactly as before.
    // `[\s\S]` rather than the `s` flag: this repo's tsconfig target predates it.
    expect(api).toMatch(/wanted\.length === 1[\s\S]*query\.eq\('category', wanted\[0\]\)/);
    expect(api).toMatch(/wanted\.length > 1[\s\S]*query\.in\('category', wanted\)/);
  });

  it('rejects an unknown category instead of returning an empty list', () => {
    // Silently returning zero rows would read as "this cause has no campaigns".
    expect(api).toMatch(/UNKNOWN_CATEGORY/);
  });

  it('returns the fields the card needs, so loaded cards match rendered ones', () => {
    // The Verified badge and countdown come from these. Omitting them makes
    // everything past the first six render subtly differently.
    for (const col of ['trust_status', 'nonprofit_verified', 'campaign_health_score']) {
      expect(api, `${col} is missing from the list select`).toMatch(
        new RegExp(`select\\('[^']*${col}`),
      );
    }
  });
});

describe('the button behaves when things go wrong', () => {
  it('does not claim the list has ended when a fetch FAILS', () => {
    // Hiding the button on error would assert "nothing more to see", which is
    // the one thing a failed request cannot tell us.
    expect(list).toMatch(/catch \{[\s\S]{0,200}setFailed\(true\)/);
    expect(list, 'hasMore must not be cleared in the catch').not.toMatch(
      /catch \{[\s\S]{0,200}setHasMore\(false\)/,
    );
  });

  it('derives the next page from what is on screen, so a retry repeats it', () => {
    expect(list).toMatch(/Math\.floor\(campaigns\.length \/ CAUSE_PAGE_SIZE\) \+ 1/);
  });

  it('de-duplicates by id', () => {
    // Ordering is by raised_amount, which a donation can change mid-session; a
    // row crossing the page boundary would otherwise duplicate its React key.
    expect(list).toMatch(/new Set\(prev\.map\(\(c\) => c\.id\)\)/);
  });

  it('ends the list on a short page rather than trusting a reported total', () => {
    expect(list).toMatch(/setHasMore\(next\.length === CAUSE_PAGE_SIZE\)/);
  });
});

describe('the button is readable and reachable in both themes', () => {
  it('is a real <button>, not a link', () => {
    // It performs an action on the page; a link would promise navigation and
    // break the keyboard/AT contract.
    expect(list).toMatch(/<button\s/);
    expect(list).toMatch(/type="button"/);
  });

  it('is styled with tokens, so it flips with the theme', () => {
    const block = css.slice(css.indexOf('.cl-more-btn {'));
    const rule = block.slice(0, block.indexOf('}'));
    expect(rule).toMatch(/background: var\(--s2\)/);
    expect(rule).toMatch(/color: var\(--t1\)/);
    expect(
      rule.match(/#[0-9a-fA-F]{3,8}/),
      'a hardcoded colour here is the muted-slate regression again',
    ).toBeNull();
  });

  it('keeps a visible focus ring for keyboard users', () => {
    expect(css).toMatch(/\.cl-more-btn:focus-visible \{[^}]*outline:/);
  });

  it('disables itself while loading, so a double click cannot double-fetch', () => {
    expect(list).toMatch(/disabled=\{loading\}/);
  });
});
