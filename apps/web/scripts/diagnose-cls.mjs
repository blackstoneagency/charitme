// Diagnostic: report WHICH elements shift, not just the CLS total.
//
//   node scripts/diagnose-cls.mjs http://127.0.0.1:3000 /campaigns /leaderboard
//
// `audit:web-vitals` gives a CLS number per route. A number alone is a trap: on
// this repo it flagged 5 routes over budget, and the obvious reading — "the
// skeletons are wrong, tighten them" — would have made production WORSE.
//
// This script names the shifting element, which settled it in one run: every
// failing route had a SINGLE shift, the <footer class="kind-footer">, moving
// because `loading.tsx` reserves space for a populated grid while the page then
// rendered an EMPTY state ("No active campaigns yet"). The skeletons are right;
// the sandbox database is unreachable, so there is no data to fill them.
//
// Re-run this against an instance with real data before changing any skeleton.
// If the shift source is still the footer, the skeleton genuinely mismatches its
// content. If it is an <img>, that image is missing width/height.
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const routes = process.argv.slice(3);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

for (const path of routes) {
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.__shifts.push({
          value: e.value,
          sources: (e.sources || []).map((s) => ({
            tag: s.node?.tagName ?? '?',
            cls: (s.node?.className ?? '').toString().slice(0, 60),
            id: s.node?.id ?? '',
            prev: s.previousRect ? `${Math.round(s.previousRect.width)}x${Math.round(s.previousRect.height)}@${Math.round(s.previousRect.y)}` : '-',
            cur: s.currentRect ? `${Math.round(s.currentRect.width)}x${Math.round(s.currentRect.height)}@${Math.round(s.currentRect.y)}` : '-',
          })),
        });
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const shifts = await page.evaluate(() => window.__shifts);
  const total = shifts.reduce((a, s) => a + s.value, 0);
  console.log(`\n=== ${path}  CLS=${total.toFixed(4)}  (${shifts.length} shift events)`);
  for (const s of shifts.sort((a, b2) => b2.value - a.value).slice(0, 6)) {
    console.log(`  ${s.value.toFixed(4)}`);
    for (const src of s.sources.slice(0, 4)) {
      console.log(`      <${src.tag}> class="${src.cls}" id="${src.id}"  ${src.prev} -> ${src.cur}`);
    }
  }
  await page.close();
}
await b.close();
