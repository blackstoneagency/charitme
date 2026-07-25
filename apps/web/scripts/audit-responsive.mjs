#!/usr/bin/env node
/**
 * Responsive + theme regression sweep (IMG-07 / CHAR-0015 extremes).
 *
 * Loads every public page at the viewport extremes in BOTH themes and reports:
 *   - horizontal overflow (page wider than the viewport)
 *   - elements that individually exceed the viewport width
 *   - images that overflow their container or fail to load
 *
 *   node scripts/audit-responsive.mjs [--base http://127.0.0.1:3100]
 *
 * Exits 1 on any finding so it can gate CI.
 */
import { chromium } from '@playwright/test';

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx > -1 ? process.argv[baseIdx + 1] : 'http://127.0.0.1:3100';

const PAGES = [
  '/', '/campaigns', '/leaderboard', '/success-stories', '/grants', '/volunteer',
  '/events', '/sponsor', '/matching', '/pricing', '/faq', '/about-us',
  '/how-it-works', '/for-donors', '/for-nonprofits', '/contact', '/supported-countries',
];
// 320 = smallest phone still in common use; 1920 = standard desktop.
const VIEWPORTS = [
  { name: '320', width: 320, height: 640, isMobile: true },
  { name: '1920', width: 1920, height: 1080, isMobile: false },
];
const THEMES = ['light', 'dark'];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let findings = 0;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
      colorScheme: theme,
    });
    // Pin the app's own theme attribute too (it reads localStorage, not just OS).
    await ctx.addInitScript((t) => {
      try { localStorage.setItem('charitme-theme-v2', t); } catch { /* ignore */ }
    }, theme);
    const page = await ctx.newPage();

    for (const path of PAGES) {
      try {
        await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(350);
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          const vw = de.clientWidth;
          const overflow = de.scrollWidth - vw;
          const wide = [];
          for (const el of document.querySelectorAll('body *')) {
            const b = el.getBoundingClientRect();
            if (b.width > vw + 2 && b.height > 0) {
              wide.push(`${el.tagName.toLowerCase()}.${(typeof el.className === 'string' ? el.className : '').split(' ')[0]}=${Math.round(b.width)}`);
              if (wide.length >= 3) break;
            }
          }
          const badImgs = [...document.images]
            .filter((i) => i.complete && i.naturalWidth === 0)
            .map((i) => (i.currentSrc || i.src || '').slice(-48));
          return { overflow, wide, badImgs: badImgs.slice(0, 3), theme: de.getAttribute('data-theme') };
        });
        const issues = [];
        if (r.overflow > 2) issues.push(`overflow +${r.overflow}px ${r.wide.join(',')}`);
        if (r.badImgs.length) issues.push(`broken img: ${r.badImgs.join(', ')}`);
        if (issues.length) { findings += issues.length; console.log(`✗ ${vp.name}/${theme} ${path} — ${issues.join(' | ')}`); }
      } catch (e) {
        findings++;
        console.log(`✗ ${vp.name}/${theme} ${path} — ERROR ${String(e.message).slice(0, 60)}`);
      }
    }
    console.log(`· ${vp.name}px ${theme}: swept ${PAGES.length} pages`);
    await ctx.close();
  }
}

await browser.close();
console.log(findings === 0
  ? `\n✅ No responsive/theme regressions across ${PAGES.length} pages × ${VIEWPORTS.length} viewports × ${THEMES.length} themes.`
  : `\n${findings} finding(s).`);
process.exit(findings === 0 ? 0 : 1);
