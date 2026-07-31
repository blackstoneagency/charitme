import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PRIMARY_NAV_GROUPS, PRIMARY_NAV_DIRECT, primaryNavHrefs } from '../lib/primary-nav';
import { t } from '../lib/i18n';
import { MARKET_LOCALES } from '../lib/i18n';
import '../lib/locales';

const WEB = join(__dirname, '..');

/** Does a route pattern in app/ match this path? Mirrors Next's file routing. */
function routeExists(path: string): boolean {
  const segments = path.split('/').filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) {
      if (['page.tsx', 'page.ts', 'page.jsx', 'page.js'].some((f) => existsSync(join(dir, f)))) return true;
      // The page may sit inside a route group at the FINAL segment too —
      // /campaigns is app/campaigns/(list)/page.tsx. Checking groups only while
      // segments remained reported five live routes as missing.
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        if (entry.startsWith('(') && entry.endsWith(')') && walk(full, [])) return true;
      }
      return false;
    }
    const [head, ...tail] = rest;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      // Route groups like (list) do not consume a URL segment.
      if (entry.startsWith('(') && entry.endsWith(')')) {
        if (walk(full, rest)) return true;
        continue;
      }
      if (entry === head || (entry.startsWith('[') && entry.endsWith(']'))) {
        if (walk(full, tail)) return true;
      }
    }
    return false;
  };
  return walk(join(WEB, 'app'), segments);
}

describe('primary navigation', () => {
  it('exposes the groups the header promises', () => {
    expect(PRIMARY_NAV_GROUPS.map((g) => g.label)).toEqual(['Explore', 'Causes', 'Resources']);
    for (const g of PRIMARY_NAV_GROUPS) expect(g.links.length).toBeGreaterThanOrEqual(4);
  });

  it('every header destination is a page that exists', () => {
    // A nav link to a 404 is worse than no link: the visitor trusts the header.
    const dead = primaryNavHrefs().filter((h) => !routeExists(h));
    expect(dead).toEqual([]);
  });

  it('the route matcher is not vacuously true', () => {
    // Without this, a broken matcher would report every link healthy.
    expect(routeExists('/pricing')).toBe(true);
    expect(routeExists('/definitely-not-a-real-route')).toBe(false);
  });

  it('no destination is listed twice in the header', () => {
    const hrefs = primaryNavHrefs();
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('every label and blurb is translated in every market', () => {
    const untranslated: string[] = [];
    const keys = [
      ...PRIMARY_NAV_GROUPS.flatMap((g) => [g.labelKey, g.blurbKey, ...g.links.map((l) => l.labelKey)]),
      ...PRIMARY_NAV_DIRECT.map((l) => l.labelKey),
    ];
    for (const key of keys) {
      for (const market of MARKET_LOCALES) {
        // `t` returns the key itself when nothing defines it.
        if (t(key, market.tag) === key) untranslated.push(`${market.tag}:${key}`);
      }
    }
    expect(untranslated).toEqual([]);
  });
});
