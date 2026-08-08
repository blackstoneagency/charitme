import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INDEXABLE_PUBLIC_ROUTES } from '../lib/public-routes';
import { FOOTER_SECTIONS, FOOTER_LEGAL_BAR } from '../lib/footer-nav';
import { flattenNav } from '../lib/main-nav';

// ─────────────────────────────────────────────────────────────────────────────
// A page in the sitemap that nothing links to is crawlable and unreachable —
// Google can find it and a person cannot. This repo has produced that shape four
// times at the data layer (saved_campaigns, creator_profiles, api_keys,
// exclusive_posts) and a sweep on 2026-08-01 found TEN instances of it at the
// page layer, including /search: the header's magnifying-glass button was
// labelled "Search campaigns" and pointed at /campaigns, so the one control on
// the site that says search did not reach the search page.
//
// Nothing about that is visible to typecheck, lint or a rendering test. Only
// counting finds it, so this counts.
// ─────────────────────────────────────────────────────────────────────────────

const APP_SHELL = readFileSync(join(__dirname, '..', 'components', 'AppShell.tsx'), 'utf8');

/**
 * Routes allowed to have no entry in the mega-menu or footer. Each one needs a
 * reason, and the reasons that claim another link exists are CHECKED below
 * rather than trusted — an exemption nobody verifies is just a silenced test.
 */
const EXEMPT: Record<string, string> = {
  '/': 'reached by the logo in the header, which is not part of MAIN_NAV',
  '/search': 'reached by the header search form in AppShell.tsx (asserted below)',
  '/causes/mental-health':
    'a cause detail page — reached from /causes, which IS in the menu. Linking all 20 individually would bury the menu.',
};

function linkedFromChrome(): Set<string> {
  const hrefs = new Set<string>();
  for (const link of flattenNav()) hrefs.add(link.href.split('?')[0]);
  for (const section of Object.values(FOOTER_SECTIONS)) for (const l of section) hrefs.add(l.href);
  for (const l of FOOTER_LEGAL_BAR) hrefs.add(l.href);
  return hrefs;
}

describe('every indexable public route is reachable from the global chrome', () => {
  it('has no unexplained orphans', () => {
    const linked = linkedFromChrome();
    const orphans = INDEXABLE_PUBLIC_ROUTES.map((r) => r.path)
      .filter((p) => !linked.has(p))
      .filter((p) => !(p in EXEMPT));
    expect(
      orphans,
      `in the sitemap, linked from neither the header nor the footer: ${orphans.join(', ')}`,
    ).toEqual([]);
  });

  it('proves the sweep can actually FAIL', () => {
    // A detector that has never failed proves nothing. Feed it a route that is
    // certainly not in the chrome and confirm it is reported.
    const linked = linkedFromChrome();
    expect(linked.has('/definitely-not-linked-anywhere')).toBe(false);
  });

  it('checks the /search exemption instead of trusting it', () => {
    // The exemption above claims the header button links to /search. If someone
    // points it back at /campaigns, the exemption becomes a lie and this fails.
    expect(APP_SHELL).toMatch(/action="\/search"[^>]*method="get"[^>]*className="kind-header-search"/);
  });

  it('exempts nothing that is already linked', () => {
    // A stale exemption hides a genuine regression the day the link is removed.
    const linked = linkedFromChrome();
    const pointless = Object.keys(EXEMPT).filter((p) => linked.has(p));
    expect(pointless, `these are linked and do not need an exemption: ${pointless.join(', ')}`).toEqual([]);
  });

  it('exempts only routes that exist in the sitemap', () => {
    const paths = new Set(INDEXABLE_PUBLIC_ROUTES.map((r) => r.path));
    const unknown = Object.keys(EXEMPT).filter((p) => !paths.has(p));
    expect(unknown, `exempted but not an indexable route: ${unknown.join(', ')}`).toEqual([]);
  });
});
