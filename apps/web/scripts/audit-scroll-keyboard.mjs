// ─────────────────────────────────────────────────────────────────────────────
// Audit: scrollable regions that keyboard users cannot reach.
//
// Mirrors axe's `scrollable-region-focusable` (WCAG 2.1.1). A container that
// scrolls needs to be focusable ONLY when it has no focusable children — a
// scroller full of links or buttons is already reachable, and giving it a
// tabIndex would add a pointless tab stop. So this reports the two cases
// separately instead of flagging every overflow container.
//
//   node scripts/audit-scroll-keyboard.mjs [baseUrl]
//
// Exits 1 when a genuinely unreachable scroller is found, so it can gate CI.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

// Public routes plus the viewports where horizontal overflow actually happens —
// most of these wrappers only scroll under a mobile breakpoint.
const ROUTES = [
  '/', '/campaigns', '/leaderboard', '/fast-payouts', '/pricing', '/transparency',
  '/features', '/how-it-works', '/faq', '/for-donors', '/for-nonprofits',
  '/volunteer', '/sponsor', '/events', '/grants', '/matching', '/impact',
  '/success-stories', '/help', '/blog', '/about-us', '/supported-countries',
];
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

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(350);
      for (const hit of await page.evaluate(PROBE)) {
        const row = { route, viewport: viewport.name, ...hit };
        // Unreachable = scrolls, is not itself focusable, and holds nothing focusable.
        if (!hit.selfFocusable && !hit.hasFocusableChild) violations.push(row);
        else alreadyReachable.push(row);
      }
    } catch (error) {
      console.warn(`  ! ${route} @${viewport.name}: ${error.message.split('\n')[0]}`);
    }
  }
  await context.close();
}
await browser.close();

const key = (r) => `${r.route} @${r.viewport} ${r.selector}`;
const uniqueViolations = [...new Map(violations.map((r) => [key(r), r])).values()];
const uniqueOk = [...new Map(alreadyReachable.map((r) => [key(r), r])).values()];

console.log(`\nScrollable regions found: ${uniqueViolations.length + uniqueOk.length}`);
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
