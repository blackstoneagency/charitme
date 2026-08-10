#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Route content contracts — "did this page actually render its DATA?"
//
// ── Why this exists ─────────────────────────────────────────────────────────
// Four separate times in one session, a route rendered a clean EMPTY STATE and
// every audit passed it:
//
//   supported_countries        fixture used invented column names
//   volunteer_opportunities    status 'active'; readers filter open|upcoming
//   connected_accounts         no rows -> payoutReady false -> the ENTIRE
//                              donate surface absent from every campaign page
//   fundraising_events,
//   grants,
//   sponsorship_opportunities  no fixture rows at all
//
// A zero-state page passes contrast, axe, responsive and target-size checks
// PERFECTLY, because there is nothing on it to fail. The sweeps were not wrong;
// they were answering a different question.
//
// ⚠️ audit-contrast DOES have an empty-render check, and it did not catch any of
// these. It counts visible leaf text across `body *` — the whole document —
// against a floor of 1 (5 when authenticated). A page with a header, nav and
// footer clears that floor with an entirely empty main region. Measuring the
// shell cannot detect missing content.
//
// So this script asserts, per route, that a MINIMUM NUMBER OF REAL ITEMS is
// present — the thing a fixture bug removes and a layout bug does not.
//
// ── How to add a route ──────────────────────────────────────────────────────
// Add an entry below with a selector that matches ONE item (a card, a row), and
// the minimum count that proves the list is populated. Prefer a selector tied to
// the item's own markup over a container: a container renders whether or not it
// has children, which is the exact failure this guards.
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import { resolveBase } from './lib/audit-base.mjs';
import publicRoutes from '../e2e/public-routes.json' with { type: 'json' };
import { resolveChromium } from './lib/audit-browser.mjs';

const BASE = resolveBase(process.argv);

/**
 * Each contract: the route, a selector matching a single rendered item, and the
 * minimum number that must be present for the page to count as populated.
 *
 * `min` is deliberately 1 for most: the point is distinguishing "rendered its
 * data" from "rendered nothing", not pinning a fixture's exact size, which would
 * break every time the fixtures change.
 */
// ⚠️ EVERY selector here was verified against the page's REAL markup before
// being trusted. My first draft failed 3 routes and ALL THREE were harness
// artifacts, not defects — the same 7-of-7 artifact rate the focus-order audit
// hit on its first run:
//   /supported-countries  I guessed `li, tr`; it renders `.sc-country-card` divs
//   /sponsor, /leaderboard  measured while their skeletons were still up
// A guard that cries wolf is worse than no guard, because the next person
// learns to ignore it.
//
// ⚠️ The PATHS are NOT declared here. They are validated against
// e2e/public-routes.json, the single source of truth — route-list-single-source
// caught this file doing otherwise, and its message records why: five copies
// existed before, all five drifted, and two listed routes that were not public,
// so the sweeps audited /login and passed. This map only attaches a selector and
// a minimum to a path the canonical list already contains.
const CONTRACT_SPECS = {
  '/campaigns': { selector: 'a[href^="/campaigns/"]', min: 3, what: 'campaign cards' },
  '/events': { selector: 'a[href^="/events/"]', min: 1, what: 'event entries' },
  '/grants': { selector: 'a[href^="/grants/"]', min: 1, what: 'grant entries' },
  '/volunteer': { selector: 'a[href^="/volunteer/"]', min: 1, what: 'volunteer opportunities' },
  '/supported-countries': { selector: '.sc-country-card', min: 5, what: 'country cards' },
  '/impact-map': { selector: 'li, tr, [class*="imp-"]', min: 3, what: 'location rows' },
  // Client-rendered: these fetch after hydration and show skeletons meanwhile.
  '/sponsor': { selector: 'a[href^="/sponsor/"], article', min: 1, what: 'sponsorship opportunities', clientRendered: true },
  '/leaderboard': { selector: 'a[href^="/campaigns/"], a[href^="/donors/"]', min: 1, what: 'leaderboard rows', clientRendered: true },
};

const canonical = new Set(
  // The file is an object; the public sweep list lives under `public`.
  publicRoutes.public.map((r) => (typeof r === 'string' ? r : r.path)).filter(Boolean),
);
// A contract for a route that is no longer public would silently stop being
// checked — or worse, check a redirect. Fail loudly instead.
const unknown = Object.keys(CONTRACT_SPECS).filter((p) => !canonical.has(p));
if (unknown.length > 0) {
  console.log(`✗ contracts reference routes absent from e2e/public-routes.json: ${unknown.join(', ')}`);
  process.exit(2);
}

const CONTRACTS = Object.entries(CONTRACT_SPECS).map(([path, spec]) => ({ path, ...spec }));

const browser = await chromium.launch({ executablePath: resolveChromium() });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let failures = 0;
let checked = 0;

for (const { path, selector, min, what, clientRendered } of CONTRACTS) {
  let response;
  try {
    response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  } catch (navigationError) {
    console.log(`✗ ${path} — navigation failed: ${String(navigationError.message).slice(0, 80)}`);
    failures++;
    continue;
  }
  // A non-200 is a different defect, and reporting it as "no content" would
  // send the next person hunting for a fixture that is not the problem.
  if (!response || response.status() !== 200) {
    console.log(`✗ ${path} — HTTP ${response ? response.status() : 'no response'}`);
    failures++;
    continue;
  }
  // ⚠️ Wait out the loading skeletons before counting. Measuring too early
  // reports a populated client-rendered page as empty — which is exactly the
  // false alarm this script exists NOT to raise. Bounded, and a route still
  // skeletonised at the deadline is reported as such rather than as "no data",
  // because those are different problems with different fixes.
  let stillLoading = false;
  if (clientRendered) {
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('.pc-skeleton-block').length === 0,
        null,
        { timeout: 15_000 },
      );
    } catch {
      stillLoading = true;
    }
  }
  await page.waitForTimeout(600);

  if (stillLoading) {
    console.log(`✗ ${path} — still rendering skeletons after 15s; could not measure content`);
    failures++;
    checked++;
    continue;
  }

  const count = await page.evaluate((sel) => {
    const main = document.querySelector('main, [role="main"], .kf-main') ?? document.body;
    // Scoped to MAIN: the header and footer render on every page and would
    // satisfy almost any selector, which is how a document-wide count misses
    // an empty content region entirely.
    return main.querySelectorAll(sel).length;
  }, selector);

  checked++;
  if (count < min) {
    console.log(`✗ ${path} — ${count} ${what} (need ≥ ${min}). Page loaded but rendered no data.`);
    failures++;
  } else {
    console.log(`· ${path} — ${count} ${what}`);
  }
}

await browser.close();

// A sweep that measured nothing must never report success — the same class of
// bug this whole script exists to catch.
if (checked === 0) {
  console.log('\n✗ nothing was audited — every route failed to load. Is the server up?');
  process.exit(2);
}

console.log(
  failures === 0
    ? `\n✅ all ${checked} route content contracts satisfied`
    : `\n❌ ${failures} route(s) loaded but rendered no data`,
);
process.exit(failures === 0 ? 0 : 1);
