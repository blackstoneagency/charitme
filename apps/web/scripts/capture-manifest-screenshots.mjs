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
