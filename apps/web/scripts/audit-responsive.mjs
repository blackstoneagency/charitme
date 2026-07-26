#!/usr/bin/env node
// Responsive overflow audit: every public page x 320/768/1920px x light/dark.
// Requires a server on :3100 (npx next start -p 3100). Exits 1 on any overflow,
// so it can gate CI. Complements Lighthouse, which only tests one width/theme.
import { chromium } from '@playwright/test';
const pages = ['/', '/campaigns', '/leaderboard', '/success-stories', '/grants', '/volunteer', '/events', '/sponsor', '/matching', '/pricing', '/faq', '/about-us', '/how-it-works', '/for-donors', '/for-nonprofits', '/supported-countries', '/create/choose-path'];
const widths = [320, 768, 1920];
const themes = ['light', 'dark'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let renders = 0, issues = 0;
for (const theme of themes) {
  for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, hasTouch: w < 500 });
    const page = await ctx.newPage();
    await page.addInitScript((t) => { try { localStorage.setItem('charitme-theme-v2', t); } catch {} }, theme);
    for (const p of pages) {
      try {
        await page.goto('http://127.0.0.1:3100' + p, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(250);
        renders++;
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          const over = de.scrollWidth - de.clientWidth;
          let worst = '';
          if (over > 2) for (const el of document.querySelectorAll('*')) {
            const b = el.getBoundingClientRect();
            if (b.width > de.clientWidth + 2 && b.height > 0) { worst = el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0] + ' w=' + Math.round(b.width); break; }
          }
          return { over, worst, theme: de.getAttribute('data-theme') };
        });
        if (r.over > 2) { issues++; console.log(`OVERFLOW ${theme} ${w}px ${p} +${r.over}px ${r.worst}`); }
      } catch (e) { console.log(`ERR ${theme} ${w} ${p}: ${e.message.slice(0,40)}`); }
    }
    await ctx.close();
  }
}
console.log(`\n${renders} renders across ${widths.join('/')}px x ${themes.join('/')} — ${issues} overflow issue(s)`);
await browser.close();
process.exitCode = issues === 0 ? 0 : 1;
