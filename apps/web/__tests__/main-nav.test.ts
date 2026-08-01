import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MAIN_NAV, allNavHrefs, flattenNav } from '../lib/main-nav';

describe('header structure', () => {
  it('keeps the desktop bar at six top-level items', () => {
    // Not cosmetic. #98 measured that the header has NO spare horizontal
    // capacity below 1366px — the nav overflowed under `.kind-auth` and made
    // three links unclickable sitewide. Two dropdowns absorbing twenty
    // destinations is what makes this structure fit. A seventh item needs a
    // measurement at 1366/1440, not a judgement call, so this test makes adding
    // one a deliberate act.
    expect(MAIN_NAV).toHaveLength(6);
  });

  it('has exactly the two dropdowns the design specifies', () => {
    const menus = MAIN_NAV.filter((i) => i.kind === 'menu');
    expect(menus.map((m) => m.label)).toEqual(['Explore Causes', 'Resources']);
  });

  it('gives every dropdown a unique id for aria-controls', () => {
    // Two menus sharing an id would point both triggers' aria-controls at the
    // same panel, which screen readers report as one expandable region.
    const ids = MAIN_NAV.flatMap((i) => (i.kind === 'menu' ? [i.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('describes every Resources link and no cause link', () => {
    // The design shows descriptions in Resources only; causes are a plain list.
    const resources = MAIN_NAV.find((i) => i.kind === 'menu' && i.label === 'Resources');
    const causes = MAIN_NAV.find((i) => i.kind === 'menu' && i.label === 'Explore Causes');

    if (resources?.kind !== 'menu' || causes?.kind !== 'menu') throw new Error('menus missing');

    for (const col of resources.columns) {
      for (const l of col.links) expect(l.description, l.label).toBeTruthy();
    }
    for (const col of causes.columns) {
      for (const l of col.links) expect(l.description, l.label).toBeUndefined();
    }
  });

  it('lays the dropdowns out in the columns the design shows', () => {
    const [causes, , , , , resources] = MAIN_NAV;
    if (causes.kind !== 'menu' || resources.kind !== 'menu') throw new Error('menus missing');

    expect(causes.columns.map((c) => c.heading)).toEqual(['Popular Causes', 'All Causes']);
    expect(causes.columns.map((c) => c.links.length)).toEqual([8, 12]);
    // Both cause columns end with "View All Causes →" in the design.
    expect(causes.columns.every((c) => c.footer?.href === '/causes')).toBe(true);

    expect(resources.columns.map((c) => c.heading)).toEqual(['Learn', 'Get Involved', 'For Organizations']);
    // Six apiece, not the original four: a sweep of INDEXABLE_PUBLIC_ROUTES
    // against the header and footer found ten public pages with no inbound link
    // anywhere in the global chrome, and /roles, /supporter-space, /teams and
    // /get-involved belong in this menu. The columns are still EQUAL, which is
    // what the design actually constrains — a menu with 6/6/4 columns looks
    // like a bug, and the header's horizontal budget is unaffected by depth.
    expect(resources.columns.map((c) => c.links.length)).toEqual([6, 6, 6]);
  });
});

describe('flattenNav — the mobile sheet', () => {
  it('reaches every destination the desktop bar does', () => {
    // The whole reason this function exists. When desktop and mobile each held
    // their own list, a link added to one silently missed the other.
    const flat = new Set(flattenNav().map((l) => l.href));
    for (const href of allNavHrefs()) expect(flat.has(href), href).toBe(true);
  });

  it('does not repeat "View All Causes", which both cause columns share', () => {
    // One link shown twice is deliberate in a two-column layout and reads as a
    // bug in a single-column sheet.
    const viewAll = flattenNav().filter((l) => l.href === '/causes');
    expect(viewAll).toHaveLength(1);
  });

  it('tags nested links with their column heading and top-level links with null', () => {
    const flat = flattenNav();
    expect(flat.find((l) => l.href === '/how-it-works')?.heading).toBeNull();
    expect(flat.find((l) => l.href === '/blog')?.heading).toBe('Learn');
  });
});

describe('every header link goes somewhere real', () => {
  // A nav is the one place a dead link is guaranteed to be seen, on every page.
  // This resolves each href against the App Router tree rather than trusting the
  // list — that is what turns "I think I built that page" into a check.
  it('resolves each internal href to a page.tsx', async () => {
    const { readdirSync } = await import('node:fs');
    const appDir = join(process.cwd(), 'app');

    // Resolve a URL path the way the App Router does. Three things make a naive
    // path join wrong, and all three are live in this repo:
    //   • route groups — /campaigns is app/campaigns/(list)/page.tsx
    //   • dynamic segments — /causes/mental-health is app/causes/[slug]/page.tsx
    //   • catch-alls — [...slug]
    // Missing any of them reports a working route as broken, which is the kind
    // of false alarm that gets a test deleted instead of fixed.
    const resolves = (dir: string, segments: string[]): boolean => {
      if (!existsSync(dir)) return false;

      if (segments.length === 0) {
        if (existsSync(join(dir, 'page.tsx'))) return true;
        return readdirSync(dir).some(
          (e) => e.startsWith('(') && resolves(join(dir, e), []),
        );
      }

      const [head, ...rest] = segments;
      if (resolves(join(dir, head), rest)) return true;

      for (const entry of readdirSync(dir)) {
        // Descend through route groups without consuming a URL segment.
        if (entry.startsWith('(') && resolves(join(dir, entry), segments)) return true;
        if (entry.startsWith('[')) {
          // A catch-all swallows every remaining segment.
          if (entry.startsWith('[...') || entry.startsWith('[[...')) {
            if (existsSync(join(dir, entry, 'page.tsx'))) return true;
          } else if (resolves(join(dir, entry), rest)) return true;
        }
      }
      return false;
    };

    const missing = allNavHrefs()
      .map((href) => href.split('?')[0])
      .filter((path) => path.startsWith('/'))
      .filter((path) => !resolves(appDir, path.split('/').filter(Boolean)));

    expect(
      missing,
      'The header links to these routes but no page exists, so they 404 from ' +
        'every page on the site:\n  ' + missing.join('\n  '),
    ).toEqual([]);
  });
});
