import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CATEGORIES } from '@shared/fees';
import {
  ALL_CAUSES_COLUMN,
  CAUSES,
  POPULAR_CAUSES,
  causeBrowseHref,
  getCause,
  uncoveredCategories,
} from '../lib/causes';

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
  it('uses the /campaigns filter when the cause is exactly one category', () => {
    expect(causeBrowseHref(getCause('education')!)).toBe('/campaigns?category=Education');
    expect(causeBrowseHref(getCause('environment')!)).toBe('/campaigns?category=Environment');
  });

  it('keeps multi-category causes on their own page', () => {
    // /campaigns filters on a single category. Pointing a multi-category cause
    // there would silently drop every category but the first — the page would
    // look like it worked and show a subset.
    expect(causeBrowseHref(getCause('animals-planet')!)).toBe('/causes/animals-planet');
    expect(causeBrowseHref(getCause('people-in-need')!)).toBe('/causes/people-in-need');
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
