#!/usr/bin/env node
/**
 * Capture the `screenshots` the web app manifest advertises.
 *
 *   npm run build && npx next start -p 4123
 *   node scripts/capture-manifest-screenshots.mjs --base http://127.0.0.1:4123
 *
 * Without them Chrome on Android shows the one-line install infobar instead of
 * the rich install dialog, and a Play Store TWA generated from this manifest
 * carries no listing imagery.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ THIS WAS RECORDED AS ABANDONED — "page.screenshot() times out at 30s on /
 * and /campaigns, almost certainly the hero carousel and the CountUp
 * animations". Measured again here: the home route captures in
 * 0.6–1.3s and /campaigns in 1.2–1.6s, with and without off-origin blocking. The pages were never the
 * problem.
 *
 * The two settings that DO hang, and which the earlier attempt used:
 *
 *   · `waitUntil: 'networkidle'` — cannot settle on a page whose covers point
 *     at hosts this sandbox cannot reach. Idle never arrives; the wait burns the
 *     whole timeout. (Same root cause as the data-wiring sweep's ten silently
 *     unmeasured routes.)
 *   · `animations: 'disabled'` — Playwright waits for CSS animations to finish
 *     before shooting. The hero carousel never finishes, because it is infinite.
 *
 * So: `waitUntil: 'load'`, animations left alone, and a short settle instead.
 * If a future run hangs again, suspect the wait condition before the page.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { resolveBase } from './lib/audit-base.mjs';
import { WEB_ROOT } from './lib/dead-css.mjs';

const BASE = resolveBase(process.argv, 'http://127.0.0.1:4123');
const OUT_DIR = join(WEB_ROOT, 'public', 'screenshots');

/**
 * A phone frame, not a desktop one. `form_factor: 'narrow'` is what makes Chrome
 * Android show the rich dialog; a wide-only set is ignored there.
 *
 * DPR 2 so the file is 780×1688 real pixels — above Chrome's 320px floor and far
 * below its 3840px ceiling, and sharp on the device that will display it.
 */
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2;

/**
 * Store LISTING screenshots, at the exact pixel sizes each console demands.
 *
 * ⚠️ These are not the manifest screenshots above and cannot be reused as them:
 * both consoles reject a size mismatch outright rather than scaling, and Chrome's
 * install dialog wants a phone-shaped image rather than a 2796px-tall one.
 *
 * Sizes are the current required device classes. Apple asks for one set per
 * supported display size; Play wants at least two phone screenshots between
 * 320px and 3840px on the long edge.
 */
const STORE_DEVICES = [
  { key: 'ios-6.7', width: 1290, height: 2796, scale: 3, label: 'iPhone 6.7"' },
  { key: 'ios-6.5', width: 1242, height: 2688, scale: 3, label: 'iPhone 6.5"' },
  { key: 'play-phone', width: 1080, height: 1920, scale: 2, label: 'Play phone' },
];

const SHOTS = [
  { file: 'home.png', path: '/', label: 'Discover campaigns to support' },
  { file: 'campaigns.png', path: '/campaigns', label: 'Browse fundraisers by cause' },
  { file: 'donate.png', path: '/donate', label: 'Give in seconds' },
  { file: 'how-it-works.png', path: '/how-it-works', label: 'Start your own fundraiser' },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
});

const captured = [];
const failed = [];

for (const shot of SHOTS) {
  const page = await context.newPage();
  try {
    const response = await page.goto(`${BASE}${shot.path}`, { waitUntil: 'load', timeout: 30_000 });
    const status = response?.status() ?? 0;
    // ⚠️ A non-200 screenshots Chromium's error page, which looks like a real
    // capture in a directory listing and ships as store imagery.
    if (status !== 200) throw new Error(`HTTP ${status}`);
    // Let the above-the-fold content paint. Not `networkidle` — see the header.
    await page.waitForTimeout(1200);

    /*
     * ⚠️ REFUSE A SCREENSHOT THAT SHOWS A FAILURE STATE.
     *
     * Measured: `/campaigns` captured here rendered "Gifts given —" while
     * production rendered "592". The em dash is this codebase's marker for a
     * read that FAILED, and the donations count times out through the sandbox's
     * proxy where it does not in production. Nothing about the image says so —
     * it is a clean, well-composed phone screenshot of a broken statistic, and
     * it would have gone into the install dialog and the store listing.
     *
     * The failure has to be caught here because no later step can see it: the
     * file is a valid PNG, the manifest is valid, and every test passes.
     */
    const brokenStats = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="stat-value"]')]
        .map((el) => el.textContent?.trim() ?? '')
        .filter((text) => text === '\u2014'),
    );
    if (brokenStats.length > 0) {
      throw new Error(`${brokenStats.length} statistic(s) render as an em dash — a failed read, not a number`);
    }

    await page.screenshot({ path: join(OUT_DIR, shot.file) });
    captured.push(shot);
    console.log(`✓ ${shot.path.padEnd(16)} → public/screenshots/${shot.file}`);
  } catch (e) {
    failed.push({ ...shot, error: String(e.message).split('\n')[0].slice(0, 70) });
    console.log(`✗ ${shot.path.padEnd(16)} ${String(e.message).split('\n')[0].slice(0, 70)}`);
  } finally {
    await page.close();
  }
}

/**
 * ⚠️ Runs only with `--store`. The listing set is 12 captures at up to 2796px
 * tall; making that the default would triple the time of a routine manifest
 * refresh for assets that change once per release.
 */
if (process.argv.includes('--store')) {
  const { mkdirSync: mkdir } = await import('node:fs');
  const storeDir = join(WEB_ROOT, 'public', 'store', 'screenshots');
  mkdir(storeDir, { recursive: true });
  let ok = 0;
  let bad = 0;

  for (const device of STORE_DEVICES) {
    // Divide by the scale factor: Playwright's viewport is in CSS pixels and
    // `deviceScaleFactor` multiplies to device pixels. Passing 1290 as the
    // viewport with scale 3 produces a 3870px image the store rejects.
    const ctx = await browser.newContext({
      viewport: { width: Math.round(device.width / device.scale), height: Math.round(device.height / device.scale) },
      deviceScaleFactor: device.scale,
      isMobile: true,
      hasTouch: true,
    });
    for (const shot of SHOTS) {
      const page = await ctx.newPage();
      try {
        const response = await page.goto(`${BASE}${shot.path}`, { waitUntil: 'load', timeout: 30_000 });
        if ((response?.status() ?? 0) !== 200) throw new Error(`HTTP ${response?.status()}`);
        await page.waitForTimeout(1200);
        // Same refusal as above: a store listing must never show a failed read.
        const broken = await page.evaluate(() =>
          [...document.querySelectorAll('[class*="stat-value"]')]
            .map((el) => el.textContent?.trim() ?? '')
            .filter((text) => text === '\u2014'),
        );
        if (broken.length > 0) throw new Error(`${broken.length} statistic(s) render as an em dash`);
        const file = `${device.key}-${shot.file}`;
        await page.screenshot({ path: join(storeDir, file) });
        ok++;
      } catch (e) {
        console.log(`✗ ${device.key} ${shot.path} — ${String(e.message).split('\n')[0].slice(0, 60)}`);
        bad++;
      } finally {
        await page.close();
      }
    }
    console.log(`· ${device.label.padEnd(14)} ${device.width}×${device.height}`);
    await ctx.close();
  }
  console.log(`\nstore listing screenshots: ${ok} captured, ${bad} failed → public/store/screenshots/`);
  if (bad > 0) {
    await browser.close();
    process.exit(1);
  }
}

await browser.close();

// The manifest reads this file, so the two can never disagree about which
// screenshots exist. A hand-maintained list in manifest.ts would eventually
// advertise a file that is not there — a 404 inside the install dialog.
const generated = {
  width: VIEWPORT.width * SCALE,
  height: VIEWPORT.height * SCALE,
  shots: captured.map((s) => ({ src: `/screenshots/${s.file}`, label: s.label })),
};
writeFileSync(join(WEB_ROOT, 'lib', 'manifest-screenshots.json'), `${JSON.stringify(generated, null, 2)}\n`);

console.log(`\n${captured.length}/${SHOTS.length} captured at ${generated.width}×${generated.height}`);
if (failed.length) {
  console.log('failed:', failed.map((f) => `${f.path} (${f.error})`).join(', '));
  process.exit(1);
}
