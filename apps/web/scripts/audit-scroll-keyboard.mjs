// ─────────────────────────────────────────────────────────────────────────────
// Audit: scrollable regions that keyboard users cannot reach.
//
// Mirrors axe's `scrollable-region-focusable` (WCAG 2.1.1). A container that
// scrolls needs to be focusable ONLY when it has no focusable children — a
// scroller full of links or buttons is already reachable, and giving it a
// tabIndex would add a pointless tab stop. So this reports the two cases
// separately instead of flagging every overflow container.
//
//   node scripts/audit-scroll-keyboard.mjs [--base <url>] [baseUrl]
//
// Exits 1 when a genuinely unreachable scroller is found, so it can gate CI.
// Exits 2 when the base URL is unreachable, or when navigation failed for so
// many routes that a green result would be meaningless — see the preflight and
// the navigation-failure check below.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Accept `--base <url>` like audit-responsive.mjs and audit-web-vitals.mjs, and
// still accept a bare positional for compatibility. The sweeps used to disagree
// on this: passing `--base` here made the URL literally "--base", every
// navigation failed, and the script printed "No keyboard-unreachable scrollable
// regions" — a green result from zero measurements.
function parseBase(argv) {
  const flagIndex = argv.indexOf('--base');
  if (flagIndex !== -1 && argv[flagIndex + 1]) return argv[flagIndex + 1];
  const positional = argv.slice(2).find((a) => !a.startsWith('--'));
  return positional ?? 'http://127.0.0.1:3000';
}
const BASE = parseBase(process.argv);
// Prefer an explicit path, then the sandbox's prebuilt browser. Without a
// fallback this dies with Playwright's "run npx playwright install" banner,
// which reads as a setup problem rather than "set PLAYWRIGHT_CHROMIUM_PATH" —
// and an audit that cannot launch produces NO signal, which is indistinguishable
// from a clean run to anyone reading a passing exit code.
const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);

// Preflight. Without it an unreachable base produces a confident pass, which is
// strictly worse than a failure: it tells you the accessibility check ran.
try {
  const probe = await fetch(BASE, { signal: AbortSignal.timeout(10_000) });
  if (!probe.ok && probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(`✗ Nothing usable on ${BASE} (${error.message}).`);
  console.error('  Start the app (`npm start` from apps/web) or pass --base <url>.');
  process.exit(2);
}

// Public routes plus the viewports where horizontal overflow actually happens —
// most of these wrappers only scroll under a mobile breakpoint.
// Validated against e2e/public-routes.json below: this is a deliberate SUBSET
// (overflow-prone wrappers only), so it is not replaced by the shared list — but
// every entry must still exist in it. That way the curation survives while a
// renamed or de-published route fails loudly instead of silently drifting, which
// is how five other copies of this list ended up auditing /login.
const ROUTES = [
  '/', '/campaigns', '/leaderboard', '/fast-payouts', '/pricing', '/transparency',
  '/features', '/how-it-works', '/faq', '/for-donors', '/for-nonprofits',
  '/volunteer', '/sponsor', '/events', '/grants', '/matching', '/impact',
  '/success-stories', '/help', '/blog', '/about-us', '/supported-countries',
];
const SHARED_PUBLIC = new Set(
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../e2e/public-routes.json', import.meta.url)), 'utf8'),
  ).public,
);
const strayRoutes = ROUTES.filter((r) => !SHARED_PUBLIC.has(r));
if (strayRoutes.length > 0) {
  console.error(
    `✗ These routes are not in e2e/public-routes.json (renamed, or no longer public):\n  ${strayRoutes.join('\n  ')}\n` +
    'Fix the list here, or move the route in the shared file. Do not audit a route that no longer resolves.',
  );
  process.exit(1);
}

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 900 },
];

const PROBE = () => {
  const FOCUSABLE =
    'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
    'textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),details,summary,video[controls],audio[controls]';
  const out = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const style = getComputedStyle(el);
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
    if (!scrollsX && !scrollsY) continue;
    if (el === document.body || el === document.documentElement) continue;

    const tabindex = el.getAttribute('tabindex');
    const selfFocusable = tabindex !== null && tabindex !== '-1';
    const hasFocusableChild = el.querySelector(FOCUSABLE) !== null;

    out.push({
      selector:
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : '') +
        (el.className && typeof el.className === 'string'
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}`
          : ''),
      axis: scrollsX ? 'x' : 'y',
      selfFocusable,
      hasFocusableChild,
      role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'),
    });
  }
  return out;
};

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
const violations = [];
const alreadyReachable = [];
let navigated = 0;
let navFailed = 0;

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      navigated++;
      await page.waitForTimeout(350);
      for (const hit of await page.evaluate(PROBE)) {
        const row = { route, viewport: viewport.name, ...hit };
        // Unreachable = scrolls, is not itself focusable, and holds nothing focusable.
        if (!hit.selfFocusable && !hit.hasFocusableChild) violations.push(row);
        else alreadyReachable.push(row);
      }
    } catch (error) {
      navFailed++;
      console.warn(`  ! ${route} @${viewport.name}: ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}
await browser.close();

// A sweep that could not load the pages has not audited anything. Reporting
// "no violations" from that state is the failure mode this project keeps
// finding: a check that passes while measuring something other than it claims.
const attempted = ROUTES.length * VIEWPORTS.length;
if (navigated === 0) {
  console.error(`\n✗ Not one of ${attempted} page loads succeeded — nothing was audited.`);
  process.exit(2);
}
if (navFailed > attempted / 2) {
  console.error(`\n✗ ${navFailed}/${attempted} page loads failed — too few pages audited to trust this result.`);
  process.exit(2);
}

const key = (r) => `${r.route} @${r.viewport} ${r.selector}`;
const uniqueViolations = [...new Map(violations.map((r) => [key(r), r])).values()];
const uniqueOk = [...new Map(alreadyReachable.map((r) => [key(r), r])).values()];

console.log(`\nAudited ${navigated}/${attempted} page loads${navFailed ? ` (${navFailed} failed)` : ''}.`);
console.log(`Scrollable regions found: ${uniqueViolations.length + uniqueOk.length}`);
console.log(`  reachable already (focusable, or contains focusable children): ${uniqueOk.length}`);
console.log(`  UNREACHABLE by keyboard: ${uniqueViolations.length}`);

if (uniqueViolations.length > 0) {
  console.log('\nUnreachable scrollers (need tabIndex={0} + a named role):');
  for (const v of uniqueViolations) {
    console.log(`  ${v.route} @${v.viewport} [${v.axis}] ${v.selector}`);
  }
  process.exit(1);
}
console.log('\nNo keyboard-unreachable scrollable regions.');
