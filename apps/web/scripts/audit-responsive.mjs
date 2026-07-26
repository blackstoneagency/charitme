#!/usr/bin/env node
/**
 * Responsive + theme regression sweep (IMG-07 / CHAR-0015 extremes).
 *
 * Loads every public page at the viewport extremes in BOTH themes and reports:
 *   - horizontal overflow (page wider than the viewport)
 *   - elements that individually exceed the viewport width
 *   - images that overflow their container or fail to load
 *   - interactive controls overlapping each other (added after a sitewide header
 *     bug that none of the above could see — see the comment at the check)
 *
 *   node scripts/audit-responsive.mjs [--base http://127.0.0.1:3100]
 *
 * Exits 1 on any finding so it can gate CI.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseIdx = process.argv.indexOf('--base');
const BASE = baseIdx > -1 ? process.argv[baseIdx + 1] : 'http://127.0.0.1:3100';

// Single source of truth, shared with the e2e sweeps (e2e/public-routes.json).
//
// This was a hand-maintained copy, and it carried the same defect all five copies
// did: /achievements and /privacy-center were listed as public while both 307 to
// /login. Playwright follows redirects, so this sweep measured the login page's
// overflow twice and reported it as two clean marketing pages.
//
// The embed fixture is excluded here: it needs seeded data, and the e2e sweep
// already covers it.
const ROUTES = JSON.parse(
  readFileSync(fileURLToPath(new URL('../e2e/public-routes.json', import.meta.url)), 'utf8'),
);
const PAGES = ROUTES.public.filter((r) => !r.includes('/embed'));
// 320 = smallest phone still in common use; 1920 = standard desktop.
const VIEWPORTS = [
  { name: '320', width: 320, height: 640, isMobile: true },
  // 768 covers the tablet/`max-width: 560px`-and-up breakpoints that neither the
  // 320 nor the 1920 pass exercises — the /leaderboard row collapse lived here.
  { name: '768', width: 768, height: 1024, isMobile: false },
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
        // Measure the page we asked for, or report it — never something we were
        // sent to. A redirect to /login (or to an SSO wall on an external target)
        // otherwise gets measured as if it were this route, and passes.
        const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
        const asked = path.replace(/\/$/, '') || '/';
        if (landed !== asked) {
          console.log(`✗ ${vp.name}/${theme} ${path} — REDIRECTED to ${landed}; not measured`);
          findings++;
          continue;
        }
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

          // Interactive controls sitting on top of each other.
          //
          // This class of bug was invisible to every audit we had. The public
          // header nav overlapped the action cluster at EVERY width from 1101px to
          // 1800px, on every page: "About Us"/"Blog"/"Contact Us" rendered
          // underneath the theme toggle, search, bell and "Sign in", and were
          // unclickable because the later-painted buttons took the clicks. The page
          // did not overflow and no element was wider than the viewport, so the
          // checks above stayed green throughout.
          //
          // Only genuinely competing controls count:
          //  - both must be visible and non-trivial in size
          //  - nesting is legitimate (a button inside a card link), so any
          //    ancestor/descendant pair is skipped
          //  - the shared area must be a real fraction of the smaller control, not
          //    a 1px rounding kiss between neighbours
          const overlaps = [];
          const controls = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')]
            .filter((el) => {
              const cs = getComputedStyle(el);
              if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
              const b = el.getBoundingClientRect();
              return b.width >= 8 && b.height >= 8 && b.bottom > 0 && b.top < window.innerHeight;
            });
          const nameOf = (el) => `${el.tagName.toLowerCase()}.${(typeof el.className === 'string' ? el.className : '').trim().split(/\s+/)[0] || '-'}`;
          for (let i = 0; i < controls.length && overlaps.length < 3; i++) {
            for (let j = i + 1; j < controls.length && overlaps.length < 3; j++) {
              const a = controls[i], b = controls[j];
              if (a.contains(b) || b.contains(a)) continue;
              const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
              const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
              const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
              if (ox <= 1 || oy <= 1) continue;
              const area = ox * oy;
              const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
              if (smaller <= 0 || area / smaller < 0.15) continue;
              overlaps.push(`${nameOf(a)} ∩ ${nameOf(b)} ${Math.round(ox)}x${Math.round(oy)}px`);
            }
          }

          return { overflow, wide, badImgs: badImgs.slice(0, 3), overlaps, theme: de.getAttribute('data-theme') };
        });
        const issues = [];
        if (r.overflow > 2) issues.push(`overflow +${r.overflow}px ${r.wide.join(',')}`);
        if (r.badImgs.length) issues.push(`broken img: ${r.badImgs.join(', ')}`);
        if (r.overlaps.length) issues.push(`overlapping controls: ${r.overlaps.join(' | ')}`);
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
