import { describe, expect, it } from 'vitest';
import { findBrokenLinks, stats } from '../scripts/audit-internal-links.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// No internal link may point at a route that does not exist.
//
// The existing broken-link crawl walks the PUBLIC pages only — an authenticated
// page 307s to /login for an anonymous crawler — so every link on the dashboard,
// the donor portal and the campaign builder went unverified. A `<Link href>` to
// a missing route renders as a perfectly normal button that 404s on click.
//
// It found one: the payout concierge handed a fundraiser `/dashboard/support`
// when their payouts were frozen or a risk flag was open — the moment they most
// need to reach a human — and that page does not exist. The same codebase
// already used `/contact` for exactly this, in the trust-score suggestions.
//
// This runs in `npm test` rather than only as a script, because CI is dead and a
// script nobody invokes is not a check.
// ─────────────────────────────────────────────────────────────────────────────

describe('internal links resolve to real routes', () => {
  it('scans a realistic amount of the app (guards against a vacuous pass)', () => {
    // The first draft matched only `href=` attributes and reported a clean 0
    // across 74 routes — vacuously, because the admin and dashboard navs are
    // arrays of TUPLES (['Overview', '/admin/super', 'grid']) with no href key.
    // That is exactly the surface it was written to cover.
    expect(stats.pages).toBeGreaterThan(100);
    expect(stats.apiRoutes).toBeGreaterThan(100);
    expect(stats.literals).toBeGreaterThan(150);
    // Template-literal links (`/dashboard/campaigns/${id}/payout-setup`) are
    // most of the dynamic navigation in the dashboard and admin console, and a
    // literal-only pass sees none of them. That gap hid a "Download printable
    // poster" button pointing at `/api/campaigns/${slug}/poster` — wrong route
    // name AND wrong identifier.
    expect(stats.templates).toBeGreaterThan(20);
  });

  it('has no link to a nonexistent route', () => {
    const broken = findBrokenLinks();
    expect(
      broken,
      'These paths appear as literals in the source but match no route in app/.\n' +
        'Either the route was renamed/removed, or the link is a typo:\n  ' +
        broken.map(([route, where]) => `${route}  ← ${where.slice(0, 3).join(', ')}`).join('\n  '),
    ).toEqual([]);
  });
});
