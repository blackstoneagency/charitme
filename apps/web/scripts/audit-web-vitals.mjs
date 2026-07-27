// ─────────────────────────────────────────────────────────────────────────────
// Audit: per-route load performance against explicit budgets.
//
//   node scripts/audit-web-vitals.mjs [--base http://127.0.0.1:3000] [--json]
//
// Measures, per public route, on a cold page load:
//   TTFB   — server response time
//   FCP    — first contentful paint
//   LCP    — largest contentful paint (the metric users feel as "loaded")
//   CLS    — layout shift accumulated up to load
//   long   — main-thread tasks > 50ms (what makes a page feel unresponsive)
//   bytes  — transferred resource weight
//
// Budgets are deliberately generous: this exists to catch a REGRESSION (a route
// that suddenly costs 4x), not to police a few ms. Exits 1 when a budget is
// breached so it can gate CI.
//
// Numbers are from a local production build on sandbox hardware — treat them as
// relative, not as field data. A route that is 5x its siblings here is a real
// finding; 300ms vs 200ms is not.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg('--base', 'http://127.0.0.1:3000');
const AS_JSON = process.argv.includes('--json');
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const BUDGET = { lcp: 4000, fcp: 3000, ttfb: 1500, cls: 0.1, long: 6 };

const ROUTES = JSON.parse(
  readFileSync(fileURLToPath(new URL('../e2e/public-routes.json', import.meta.url)), 'utf8'),
).public.filter((r) => !r.includes('/embed')); // embeds are framed fragments, not pages

try {
  const probe = await fetch(BASE, { method: 'HEAD' });
  if (probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
} catch (error) {
  console.error(
    `✗ Nothing usable on ${BASE} (${error.code ?? error.message}).\n` +
    '  Start the app (`npm start` from apps/web) or pass --base <url>.',
  );
  process.exit(2);
}

const COLLECT = () => new Promise((resolve) => {
  const out = { lcp: 0, cls: 0, long: 0 };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) out.lcp = Math.max(out.lcp, e.startTime);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { out.long += l.getEntries().length; })
      .observe({ type: 'longtask', buffered: true });
  } catch { /* older engines: partial metrics are still useful */ }

  setTimeout(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    resolve({
      ttfb: nav ? Math.round(nav.responseStart) : 0,
      fcp: fcp ? Math.round(fcp.startTime) : 0,
      lcp: Math.round(out.lcp),
      cls: Number(out.cls.toFixed(3)),
      long: out.long,
      bytes: performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), 0),
    });
  }, 2500);
});

// Chromium does NOT inherit HTTPS_PROXY from the environment the way curl/urllib do.
// Without this, every external asset (Supabase Storage covers, fonts) hangs until
// timeout and the `load` event never fires — which looks exactly like a page that
// never finishes loading. It cost a false "the homepage times out" finding once.
const PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const browser = await chromium.launch({
  ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
  ...(PROXY ? { proxy: { server: PROXY, bypass: process.env.NO_PROXY ?? '' } } : {}),
});
if (!PROXY) {
  console.warn('! HTTPS_PROXY is unset — external images may not load; treat LCP as local-only.');
}
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const results = [];

for (const route of ROUTES) {
  const page = await context.newPage();
  try {
    // `domcontentloaded`, not `load`. Waiting for `load` makes the whole audit
    // hostage to external assets: in this sandbox 2 of the homepage's 29 requests
    // (Supabase Storage covers) stall in the proxied browser while the very same
    // objects fetch in ~0.5s via curl. That produced a false "the homepage never
    // loads" finding. COLLECT still waits 2.5s afterwards, which is what LCP and
    // CLS need — they do not depend on the load event.
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const m = await page.evaluate(COLLECT);
    const over = Object.entries(BUDGET).filter(([k, limit]) => (m[k] ?? 0) > limit).map(([k]) => k);
    results.push({ route, ...m, over });
  } catch (error) {
    results.push({ route, error: error.message.split('\n')[0] });
  } finally {
    await page.close();
  }
}
await browser.close();

if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log(`\n${'route'.padEnd(30)} ${'TTFB'.padStart(6)} ${'FCP'.padStart(6)} ${'LCP'.padStart(6)} ${'CLS'.padStart(6)} ${'long'.padStart(5)} ${'KB'.padStart(7)}`);
  for (const r of [...results].sort((a, b) => (b.lcp ?? 0) - (a.lcp ?? 0))) {
    if (r.error) { console.log(`${r.route.padEnd(30)}  ERROR ${r.error}`); continue; }
    const flag = r.over.length ? `  ⚠ over: ${r.over.join(',')}` : '';
    console.log(
      `${r.route.padEnd(30)} ${String(r.ttfb).padStart(6)} ${String(r.fcp).padStart(6)} ${String(r.lcp).padStart(6)} ` +
      `${String(r.cls).padStart(6)} ${String(r.long).padStart(5)} ${String(Math.round(r.bytes / 1024)).padStart(7)}${flag}`,
    );
  }
}

const failures = results.filter((r) => r.error || r.over?.length);
const errored = results.filter((r) => r.error);
console.log(
  `\n${results.length - failures.length}/${results.length} routes within budget` +
  (errored.length ? ` · ${errored.length} failed to load` : ''),
);
if (failures.length > 0) {
  console.log(`Budgets: LCP<${BUDGET.lcp}ms FCP<${BUDGET.fcp}ms TTFB<${BUDGET.ttfb}ms CLS<${BUDGET.cls} longtasks<${BUDGET.long}`);
  process.exit(1);
}
