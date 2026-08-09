import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import {
  ALL_CAUSES_COLUMN,
  CAUSES,
  POPULAR_CAUSES,
  causeBrowseHref,
  getCause,
  uncoveredCategories, causePageHref } from '../lib/causes';

// The failure this guards against: `CAMPAIGN_CATEGORIES` is the single source of
// truth for campaign categories, and it has already drifted once when three
// copies were maintained by hand. lib/causes.ts is a MAP onto that list, so it
// can rot the same way — a category renamed in @shared/fees would leave a cause
// page querying a value no campaign has, which renders as an empty state rather
// than an error. Silent, and indistinguishable from "no campaigns yet".

const CATEGORY_SET = new Set<string>(CAMPAIGN_CATEGORIES);

describe('causes map onto the real campaign taxonomy', () => {
  it('every mapped category exists in CAMPAIGN_CATEGORIES', () => {
    const unknown = CAUSES.flatMap((c) =>
      c.categories.filter((cat) => !CATEGORY_SET.has(cat)).map((cat) => `${c.slug} → ${cat}`),
    );
    expect(
      unknown,
      'These causes query a category that @shared/fees does not define, so their ' +
        'pages would silently render empty:\n  ' + unknown.join('\n  '),
    ).toEqual([]);
  });

  it('no cause has an empty category list', () => {
    // A cause with no categories cannot query anything; its page would always be
    // empty while still appearing in the nav as a browsable destination.
    expect(CAUSES.filter((c) => c.categories.length === 0)).toEqual([]);
  });

  it('reports which categories no cause reaches', () => {
    // Not an assertion that this is empty — the nav is a curated 20, not a
    // mirror of all 18 categories. This pins the CURRENT set so that adding a
    // category without deciding where it belongs is a visible change, not a
    // silent hole in navigation.
    expect(uncoveredCategories()).toEqual(['Business', 'Travel', 'Volunteer']);
  });
});

describe('cause identity', () => {
  it('has the 8 + 12 the design specifies', () => {
    expect(POPULAR_CAUSES).toHaveLength(8);
    expect(ALL_CAUSES_COLUMN).toHaveLength(12);
    expect(CAUSES).toHaveLength(20);
  });

  it('slugs are unique — a duplicate would make one page unreachable', () => {
    const slugs = CAUSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('labels are unique', () => {
    const labels = CAUSES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('slugs are URL-safe', () => {
    // These are indexable routes; a slug needing encoding would mean the href in
    // the nav and the param the page receives could disagree.
    for (const { slug } of CAUSES) {
      expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(encodeURIComponent(slug)).toBe(slug);
    }
  });

  it('every cause carries a blurb', () => {
    // The blurb is the meta description as well as the card copy. An empty one
    // ships a page with no description into search results.
    for (const c of CAUSES) expect(c.blurb.length, c.slug).toBeGreaterThan(20);
  });
});

describe('narrower disclosure', () => {
  it('allows at most one undisclosed cause per category set', () => {
    // This is the honesty check, and its exact shape matters. Causes sharing a
    // category set render identical campaigns, so they cannot all claim to be
    // precise views. But they need not ALL disclose: "Health & Wellness" really
    // IS the Medical category, while "Mental Health" and "Medical Research" are
    // slices of it that nothing in the schema records. One broad cause per set
    // may stand unmarked; every other must say it is narrower than its query.
    //
    // (The first version of this test demanded every member of a group be
    // marked, which failed Health & Wellness and Community & Relief for being
    // accurate. Marking those `narrower` would have been a lie in the other
    // direction.)
    const byKey = new Map<string, typeof CAUSES[number][]>();
    for (const c of CAUSES) {
      const key = [...c.categories].sort().join('|');
      byKey.set(key, [...(byKey.get(key) ?? []), c]);
    }

    const ambiguous: string[] = [];
    for (const group of byKey.values()) {
      const undisclosed = group.filter((c) => !c.narrower);
      if (undisclosed.length > 1) {
        ambiguous.push(undisclosed.map((c) => c.slug).join(' == '));
      }
    }

    expect(
      ambiguous,
      'Each of these sets has two or more causes claiming to be a precise view of ' +
        'the same categories, so they render identical campaigns with no ' +
        'explanation:\n  ' + ambiguous.join('\n  '),
    ).toEqual([]);
  });

  it('a cause equal to exactly one category is not marked narrower', () => {
    // The flag must mean something. Marking everything narrower would make the
    // disclosure noise that readers learn to ignore.
    for (const c of CAUSES) {
      if (c.categories.length === 1 && c.label.toLowerCase() === c.categories[0].toLowerCase()) {
        expect(c.narrower, c.slug).toBeFalsy();
      }
    }
  });
});

describe('causeBrowseHref', () => {
  it('browses campaigns by CAUSE, for every cause, with no branch', () => {
    // ⚠️ This replaces two cases that pinned the old branching contract:
    // one category went to `/campaigns?category=…`, several went to
    // `/causes/<slug>`. Both halves broke something once cause pages became
    // real pages, and each broke a different thing:
    //
    //   · the single-category branch meant nine causes — Health & Wellness and
    //     Education among them — were never reachable from the mega-menu,
    //     which linked their NAME to a filtered campaigns list;
    //   · the multi-category branch made the hero and closing "Donate now"
    //     buttons link to the page they were already on, on eleven causes.
    //
    // `?cause=` needs no branch: /campaigns resolves the slug to the cause's
    // categories and queries with `.in(...)`, so nothing is dropped.
    expect(causeBrowseHref(getCause('education')!)).toBe('/campaigns?cause=education');
    expect(causeBrowseHref(getCause('animals-planet')!)).toBe('/campaigns?cause=animals-planet');
    for (const c of CAUSES) {
      expect(causeBrowseHref(c), `${c.slug}`).toBe(`/campaigns?cause=${c.slug}`);
    }
  });

  it('does not drop categories for a multi-category cause', () => {
    // The original reason the branch existed. `?category=` can only carry one,
    // so a multi-category cause pointed at it would silently show a subset
    // while looking like it worked. `?cause=` carries the slug instead.
    for (const c of CAUSES.filter((x) => x.categories.length > 1)) {
      expect(causeBrowseHref(c)).not.toContain('category=');
    }
  });

  it('sends a link ABOUT a cause to that cause\'s own page', () => {
    for (const c of CAUSES) {
      expect(causePageHref(c)).toBe(`/causes/${c.slug}`);
      expect(causePageHref(c), `${c.slug}`).not.toBe(causeBrowseHref(c));
    }
  });

  it('never emits an unencoded category', () => {
    for (const c of CAUSES) {
      const href = causeBrowseHref(c);
      expect(href, c.slug).not.toMatch(/[ "<>]/);
    }
  });
});

describe('getCause', () => {
  it('resolves every slug it advertises', () => {
    for (const c of CAUSES) expect(getCause(c.slug)).toBe(c);
  });

  it('returns undefined for an unknown slug so the route can 404', () => {
    expect(getCause('not-a-cause')).toBeUndefined();
    expect(getCause('')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `blurb` IS the meta description of /causes/[slug] — it is passed straight to
// `metadata.description`, `openGraph.description` and the Twitter card. That is
// not obvious from the field name, and it cost a CI failure: `animals-planet`
// was 48 characters, two short of the 50 the e2e quality spec requires of every
// indexable page, and the only signal was a 59-minute Playwright run failing on
// a number.
//
// A unit test costs milliseconds and names the actual constraint. The e2e spec
// still owns the rendered check — this stops the same defect reaching it.
// ─────────────────────────────────────────────────────────────────────────────
describe('every cause blurb is a usable meta description', () => {
  it.each(CAUSES.map((c) => [c.slug, c.blurb] as const))(
    '%s is between 50 and 180 characters',
    (_slug, blurb) => {
      expect(blurb.length).toBeGreaterThanOrEqual(50);
      expect(blurb.length).toBeLessThanOrEqual(180);
    },
  );

  it('is still what the page publishes, so this test is not measuring a dead field', () => {
    const page = readFileSync(join(__dirname, '..', 'app', 'causes', '[slug]', 'page.tsx'), 'utf8');
    expect(page, 'the cause page stopped using blurb as its description').toMatch(
      /description:\s*cause\.blurb/,
    );
  });
});
