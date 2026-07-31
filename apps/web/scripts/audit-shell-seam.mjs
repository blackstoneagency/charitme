#!/usr/bin/env node
/**
 * Is the marketing shell ONE continuous card in dark mode?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BUG THIS EXISTS FOR
 *
 * `.kind-header` and `.kind-footer` sit directly above and below `<main>`. In
 * dark mode both were `rgba(10,12,35,.92)` — a near-black tint composited over
 * the body's radial gradient — so the banner read as a distinct dark bar against
 * a purple page.
 *
 * ⚠️ It could not be fixed with a solid colour. The page behind is a GRADIENT,
 * so any single hex matches at one scanline and drifts everywhere else. The fix
 * is transparency, and this script is how that is checked rather than eyeballed.
 *
 * (An earlier version of this script compared the header against `.kind-page`.
 * That class does not exist in the DOM — it has zero usages in any component,
 * and its dark-mode rule styles nothing. Every page "skipped", and the script
 * reported a PASS on zero pages checked. Hence the hard failure below when
 * nothing is measured.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY IT SAMPLES PIXELS AND NOT getComputedStyle
 *
 * Computed style reports what the CSS asked for. It cannot tell you what
 * actually composited: alpha, backdrop-filter, a parent gradient and stacking
 * context all land in the final pixel and none of them appear in the declared
 * value. This crops 1×1 regions from a real screenshot either side of each seam
 * and compares the bytes.
 *
 * Usage: node scripts/audit-shell-seam.mjs [--base http://127.0.0.1:4280]
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { resolveBase } from './lib/audit-base.mjs';
import { chromiumLaunchOptions } from './lib/audit-browser.mjs';

const BASE = resolveBase(process.argv.slice(2), 'http://127.0.0.1:4280');

// Single source of truth: e2e/public-routes.json, same as the contrast and
// responsive sweeps. A hardcoded list here would be a fourth copy to drift —
// which is exactly how those two sweeps once ended up auditing the login page
// and counting it as two clean marketing pages.
//
// `/embed` is excluded: it renders a bare widget with no marketing shell, so it
// has no banner to compare.
const ROUTE_DATA = JSON.parse(
  readFileSync(fileURLToPath(new URL('../e2e/public-routes.json', import.meta.url)), 'utf8'),
);
const PAGES = ROUTE_DATA.public.filter((r) => !r.includes('/embed'));

const browser = await chromium.launch(chromiumLaunchOptions());
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });

// Abort third-party font and image requests. `page.screenshot()` waits for fonts
// to load, and this sandbox has no route to Google Fonts, so every capture hung
// for the full 30s timeout. Blocking them is also *correct* for this measurement:
// it samples flat background colour, which no webfont or photo affects.
await ctx.route('**/*', (route) => {
  const req = route.request();
  const external = !req.url().startsWith(BASE);
  const heavy = ['font', 'image', 'media'].includes(req.resourceType());
  return external && heavy ? route.abort() : route.continue();
});

// ⚠️ Seed the theme BEFORE any page loads. ThemeProvider reads
// `localStorage['charitme-theme-v2']` in a mount effect and writes `data-theme`
// from it — so setting the attribute after navigation is undone the moment the
// app hydrates. An earlier run of this script did exactly that and measured the
// LIGHT theme (#ffffff) while reporting on dark, which would have "proved" a
// seam that had nothing to do with dark mode.
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('charitme-theme-v2', 'dark');
  } catch {
    /* storage disabled — the colorScheme context option still applies */
  }
});

const page = await ctx.newPage();

let seams = 0;
let checked = 0;
let skipped = 0;

for (const path of PAGES) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  // Wait for the theme the APP chose, rather than forcing one — forcing it is
  // what hid the hydration reset last time.
  await page
    .waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', null, { timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(200);

  const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  if (theme !== 'dark') {
    console.log(`  ✗  ${path.padEnd(17)} rendered in "${theme}" — cannot judge dark mode here`);
    seams++;
    continue;
  }

  // ── THE MEASUREMENT ────────────────────────────────────────────────────────
  //
  // Screenshot the header strip, then HIDE the header and screenshot the same
  // rectangle again. If the banner is truly the page's own colour, the two are
  // byte-identical: removing it changes nothing.
  //
  // This is stronger than comparing the header against the element below it.
  // `<main>`'s first child is usually a hero band with its OWN background, so
  // that comparison reports a difference that is a design choice rather than a
  // seam — it flagged 11 pages that were already correct.
  const box = await page.evaluate(() => {
    const h = document.querySelector('.kind-header');
    if (!h) return null;
    const b = h.getBoundingClientRect();
    if (b.width < 40 || b.height < 20) return null;
    // Playwright's clip uses x/y, not left/top.
    return {
      x: Math.max(0, Math.round(b.left) + 2),
      y: Math.max(0, Math.round(b.top) + 2),
      width: Math.max(1, Math.round(b.width) - 4),
      height: Math.max(1, Math.round(b.height) - 4),
    };
  });

  if (!box) {
    skipped++;
    console.log(`  ·  ${path.padEnd(17)} no .kind-header — skipped`);
    continue;
  }
  checked++;

  // Neutralise only the SURFACE, never the content.
  //
  // An earlier version used `visibility: hidden`, which also removed the logo
  // and nav — so ~14% of pixels "differed" simply because the text vanished, on
  // every page including the correct ones. The logo is supposed to differ from
  // the page; the background is what is under test.
  const withHeader = await page.screenshot({ type: 'png', clip: box });
  await page.evaluate(() => {
    const h = document.querySelector('.kind-header');
    if (!h) return;
    h.dataset.seamProbe = '1';
    h.style.background = 'none';
    h.style.backdropFilter = 'none';
    h.style.boxShadow = 'none';
  });
  await page.waitForTimeout(120);
  const withoutHeader = await page.screenshot({ type: 'png', clip: box });
  await page.evaluate(() => {
    const h = document.querySelector('.kind-header');
    if (!h) return;
    h.style.background = '';
    h.style.backdropFilter = '';
    h.style.boxShadow = '';
    delete h.dataset.seamProbe;
  });

  // Layout and content are identical in both shots, so any pixel difference is
  // the header's own surface painting.
  const a = await sharp(withHeader).raw().toBuffer();
  const bpx = await sharp(withoutHeader).raw().toBuffer();

  let diff = 0;
  let worst = 0;
  for (let i = 0; i < Math.min(a.length, bpx.length); i++) {
    const d = Math.abs(a[i] - bpx[i]);
    if (d > 0) diff++;
    if (d > worst) worst = d;
  }
  const total = Math.min(a.length, bpx.length);
  const pct = total ? (diff / total) * 100 : 0;
  const ok = worst === 0;
  if (!ok) seams++;

  console.log(
    `  ${ok ? '✓' : '✗'}  ${path.padEnd(17)} ` +
      (ok
        ? 'banner paints nothing — identical to the page'
        : `${pct.toFixed(1)}% of samples differ, max Δ${worst}   ← SEAM`),
  );
}

await browser.close();

console.log(`\n${'─'.repeat(64)}`);
// A pass on zero measurements is the failure mode this repo keeps recording:
// it looks identical to a real pass and proves nothing.
if (checked === 0) {
  console.log(`❌ measured NOTHING — ${skipped} page(s) had no .kind-header/<main>.`);
  console.log('   The selectors are wrong, or the app is not the one being served.');
  process.exit(2);
}
if (seams === 0) {
  console.log(`✓ no seams — banner and page are the same colour`);
  console.log(`  (${checked} marketing pages checked, ${skipped} skipped)`);
  process.exit(0);
}
console.log(`❌ ${seams} seam(s) across ${checked} marketing pages`);
process.exit(1);
