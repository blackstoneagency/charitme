import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { primaryCategory, campaignsHref, causeWays, scopeDisclosure } from '../lib/cause-ways-core';
import { POPULAR_CAUSES } from '../lib/causes';

describe('primaryCategory', () => {
  it('takes the first declared category', () => {
    expect(primaryCategory({ categories: ['Sports', 'Competition'] })).toBe('Sports');
  });

  it('is null for none or blank, so no empty filter is emitted', () => {
    // `?category=` with nothing after it renders an empty grid that reads as
    // "no campaigns in this cause" — a false statement about the cause.
    expect(primaryCategory({ categories: [] })).toBeNull();
    expect(primaryCategory({ categories: ['  '] })).toBeNull();
  });
});

describe('campaignsHref', () => {
  it('filters when there is a category', () => {
    expect(campaignsHref({ categories: ['Sports'] })).toBe('/campaigns?category=Sports');
  });

  it('encodes a category containing a space or ampersand', () => {
    expect(campaignsHref({ categories: ['Health & Care'] })).toBe('/campaigns?category=Health%20%26%20Care');
  });

  it('falls back to the unfiltered list rather than a broken query', () => {
    expect(campaignsHref({ categories: [] })).toBe('/campaigns');
  });
});

describe('causeWays', () => {
  const sports = { label: 'Sports & Youth', categories: ['Sports', 'Competition'] };

  it('marks ONLY the campaign link as cause-scoped', () => {
    // /volunteer, /events, /partner and /create accept no search params, so a
    // link to them is site-wide however it is labelled. Claiming otherwise is
    // the difference between a filtered view and one that merely looks filtered.
    const ways = causeWays(sports);
    expect(ways.filter((w) => w.scoped).map((w) => w.id)).toEqual(['donate']);
  });

  it('drops the cause name from the blurb when nothing is actually filtered', () => {
    const ways = causeWays({ label: 'Nameless', categories: [] });
    const donate = ways.find((w) => w.id === 'donate')!;
    expect(donate.scoped).toBe(false);
    expect(donate.blurb).not.toContain('Nameless');
  });

  it('names the cause when the link really does narrow', () => {
    const donate = causeWays(sports).find((w) => w.id === 'donate')!;
    expect(donate.blurb).toContain('Sports & Youth');
  });

  it('has no duplicate ids and every link is absolute', () => {
    const ways = causeWays(sports);
    expect(new Set(ways.map((w) => w.id)).size).toBe(ways.length);
    for (const way of ways) expect(way.href.startsWith('/')).toBe(true);
  });

  it('points only at routes that exist on disk', () => {
    // A dead link in a "ways to help" block is worse than no block: it is a
    // promise of a next step that 404s.
    const appDir = join(__dirname, '..', 'app');
    const exists = (route: string): boolean => {
      const clean = route.split('?')[0]!;
      const segments = clean.split('/').filter(Boolean);
      // Route groups like (list) sit between the segments on disk, so check for
      // a page.tsx anywhere under the named directory rather than at one path.
      let dir = appDir;
      for (const segment of segments) {
        const next = join(dir, segment);
        try { if (!statSync(next).isDirectory()) return false; } catch { return false; }
        dir = next;
      }
      const stack = [dir];
      while (stack.length) {
        const current = stack.pop()!;
        for (const entry of readdirSync(current)) {
          if (entry === 'page.tsx') return true;
          const full = join(current, entry);
          if (statSync(full).isDirectory() && entry.startsWith('(')) stack.push(full);
        }
      }
      return false;
    };
    for (const way of causeWays(sports)) {
      expect(exists(way.href), `${way.href} has no page.tsx`).toBe(true);
    }
  });

  it('works for every real cause, not just the fixture', () => {
    for (const cause of POPULAR_CAUSES) {
      const ways = causeWays(cause);
      expect(ways.length).toBeGreaterThan(0);
      for (const way of ways) expect(way.label.length).toBeGreaterThan(0);
    }
  });
});

describe('scopeDisclosure', () => {
  it('appears only when some links are site-wide', () => {
    const ways = causeWays({ label: 'Sports & Youth', categories: ['Sports'] });
    expect(scopeDisclosure(ways, 'Sports & Youth')).toContain('Sports & Youth');
  });

  it('is null when everything is scoped, so it is not permanent boilerplate', () => {
    expect(scopeDisclosure([{ id: 'a', label: 'A', blurb: '', href: '/x', scoped: true }], 'X')).toBeNull();
    expect(scopeDisclosure([], 'X')).toBeNull();
  });
});

describe('the /campaigns filter this relies on is real', () => {
  it('the list page reads a category search param and applies it as a query filter', () => {
    // If /campaigns ever stops honouring ?category=, the donate link silently
    // becomes unfiltered while still claiming the cause in its blurb.
    const source = readFileSync(join(__dirname, '..', 'app', 'campaigns', '(list)', 'page.tsx'), 'utf8');
    expect(source).toContain('category?: string');
    expect(source).toMatch(/\.eq\('category',\s*opts\.category\)/);
  });
});
