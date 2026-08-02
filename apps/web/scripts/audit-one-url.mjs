// Axe + horizontal-overflow check for ONE arbitrary URL, in both themes and at
// several widths.
//
// The suite's sweeps validate `--only` against `e2e/public-routes.json`, which is
// correct — it stops a typo from silently auditing nothing. But it leaves no way
// to measure a DYNAMIC route against real data: the campaign sub-routes are
// listed under a stub-fixture slug that 404s on any database without the stub,
// so the sweeps skip them and the real page goes unmeasured.
//
//   node scripts/audit-one-url.mjs http://localhost:4141/campaigns/<slug>/updates
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chromiumLaunchOptions } from './lib/audit-browser.mjs';
import { resolveBase } from './lib/audit-base.mjs';

// Through the shared resolver like every other audit script, so `--base <url>`
// and a bare positional URL both work here too. A script with its own private
// argument spelling is exactly the drift `audit-base-resolution.test.ts` exists
// to stop — three sweeps have already been run against the wrong port that way.
const url = resolveBase(process.argv, '');
if (!url) {
  console.error('usage: node scripts/audit-one-url.mjs <url>   (or --base <url>)');
  process.exit(1);
}

const WIDTHS = [320, 390, 768, 1280, 1920];
const browser = await chromium.launch(chromiumLaunchOptions());
let findings = 0;

for (const theme of ['light', 'dark']) {
  const context = await browser.newContext({ colorScheme: theme });
  const page = await context.newPage();

  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  if (!response || response.status() !== 200) {
    console.log(`✗ ${theme} — HTTP ${response?.status() ?? 0}; not measured`);
    findings++;
    await context.close();
    continue;
  }
  await page.waitForTimeout(400);

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  if (axe.violations.length) {
    findings += axe.violations.length;
    for (const v of axe.violations) console.log(`✗ ${theme} axe ${v.id} (${v.impact}) × ${v.nodes.length} — ${v.help}`);
  } else {
    console.log(`✓ ${theme} — 0 axe violations (${axe.passes.length} checks passed)`);
  }

  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(250);
    // documentElement, not body: an overflowing child can leave body at the
    // viewport width while the page still scrolls sideways.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Touch-target floor. WCAG 2.2 SC 2.5.8 is 24px; this repo aims higher, but
    // the failure reported here is the standard's own floor so it is not noise.
    const small = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('a, button, select, input, [role="button"]')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 24 || r.height < 24) out.push(`${el.tagName.toLowerCase()}: ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      return out;
    });
    if (overflow > 1) { console.log(`✗ ${theme} ${w}px — horizontal overflow of ${overflow}px`); findings++; }
    if (small.length) { console.log(`✗ ${theme} ${w}px — ${small.length} target(s) under 24px: ${small.slice(0, 4).join(', ')}`); findings++; }
    if (overflow <= 1 && !small.length) console.log(`✓ ${theme} ${w}px — no overflow, all targets ≥24px`);
  }
  await context.close();
}
await browser.close();
console.log(findings === 0 ? '\n✅ clean' : `\n❌ ${findings} finding(s)`);
process.exit(findings === 0 ? 0 : 1);
