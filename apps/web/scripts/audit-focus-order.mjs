// ─────────────────────────────────────────────────────────────────────────────
// Keyboard focus order, focus visibility, and keyboard traps.
//
// This is the part of CHAR-0015 that nothing else covers. axe checks a great
// deal, but it inspects a STATIC snapshot — it cannot tab through a page, so it
// cannot see the three failures that actually strand a keyboard user:
//
//   • a focus TRAP — Tab cycles forever inside a widget and never escapes
//   • focus order that jumps around the page instead of following reading order
//   • an element that takes focus while being invisible or off-screen, so the
//     focus ring is somewhere the user cannot see
//
// So this drives a real browser and presses Tab, which is the only way to
// answer "can someone actually navigate this without a mouse?".
//
// Usage: node scripts/audit-focus-order.mjs --base http://localhost:4200
// ─────────────────────────────────────────────────────────────────────────────

import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROUTES = JSON.parse(
  readFileSync(join(HERE, '..', 'e2e', 'public-routes.json'), 'utf8'),
).public;

const baseFlag = process.argv.indexOf('--base');
const BASE = baseFlag > -1 ? process.argv[baseFlag + 1] : 'http://localhost:3000';
const MAX_TABS = 90;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});

const problems = [];
let pagesSwept = 0;
let stopsSeen = 0;

for (const theme of ['light', 'dark']) {
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(120);

      const seen = [];
      let trapped = false;

      for (let i = 0; i < MAX_TABS; i++) {
        await page.keyboard.press('Tab');
        const stop = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          // A focus ring the browser paints somewhere invisible is the same as
          // no focus indicator at all.
          const invisible =
            cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0;
          // Delegated focus indicators are the standard custom-control pattern:
          // the native input is hidden with opacity:0 and the RING is painted on
          // a visible <label> or sibling (`.cb-filter-pill input:focus-visible +
          // span`). Treating that as "focus on an invisible element" reported a
          // correctly-implemented control as a WCAG 2.4.7 failure.
          const partner = el.closest('label') || el.nextElementSibling || el.parentElement;
          const partnerVisible = !!partner && (() => {
            const pr = partner.getBoundingClientRect();
            const pcs = getComputedStyle(partner);
            return pr.width > 0 && pr.height > 0 && pcs.visibility !== 'hidden' &&
                   pcs.display !== 'none' && Number(pcs.opacity) !== 0;
          })();

          return {
            tag: el.tagName,
            partnerVisible,
            // DOCUMENT coordinates, not viewport. Tabbing auto-scrolls, so a
            // viewport-relative top changes under the measurement and made the
            // focus-order check meaningless — it reported 6 upward jumps on a
            // page that has none, and only in one theme, purely from scroll
            // timing.
            docY: Math.round(r.top + window.scrollY),
            name: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30),
            id: el.id || null,
            cls: (el.className || '').toString().split(' ')[0],
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
            invisible,
            // Skip links are SUPPOSED to be offscreen until focused; they are
            // the standard bypass-blocks pattern, not a defect.
            isSkip: el.classList.contains('skip-link'),
          };
        });

        if (!stop) break; // focus left the document — Tab reached the browser UI
        seen.push(stop);

        // A trap means focus makes NO PROGRESS through the document. Matching on
        // link TEXT does not show that: a list of feature cards each carrying
        // "Try it now" / "Learn more" produces a perfect A-B-A-B sequence and is
        // not a trap at all — focus continues past it. Compare position instead,
        // which is what "progress" actually means.
        const n = seen.length;
        if (n >= 8) {
          const recent = seen.slice(-8);
          const distinct = new Set(recent.map((s) => `${s.docY}:${s.x}:${s.name}`));
          if (distinct.size <= 2) { trapped = true; break; }
        }
      }

      stopsSeen += seen.length;

      if (trapped) {
        problems.push(`${route} [${theme}] FOCUS TRAP near "${seen[seen.length - 1]?.name}"`);
      }

      for (const s of seen) {
        if (s.invisible && !s.isSkip && !s.partnerVisible) {
          problems.push(`${route} [${theme}] focus on invisible ${s.tag}.${s.cls} "${s.name}"`);
        }
        if (!s.isSkip && (s.w === 0 || s.h === 0)) {
          problems.push(`${route} [${theme}] focus on zero-size ${s.tag}.${s.cls} "${s.name}"`);
        }
      }

      // Focus order should broadly follow reading order. A single large upward
      // jump is normal (a menu closing, a footer link returning to a dialog);
      // repeated ones mean the DOM order and the visual order disagree.
      let backJumps = 0;
      for (let i = 1; i < seen.length; i++) {
        if (seen[i].docY < seen[i - 1].docY - 400) backJumps++;
      }
      if (backJumps > 2) {
        problems.push(`${route} [${theme}] focus order jumps upward ${backJumps}× — DOM order disagrees with visual order`);
      }

      pagesSwept++;
    } catch (err) {
      problems.push(`${route} [${theme}] could not be swept: ${String(err).slice(0, 90)}`);
    }
    await page.close();
  }
  console.log(`· ${theme}: swept ${ROUTES.length} routes`);
}

await browser.close();

// A sweep that tabbed nothing would also report no problems.
if (stopsSeen < ROUTES.length * 2) {
  console.error(`\n❌ Only ${stopsSeen} focus stops across ${pagesSwept} page loads — the sweep is not actually tabbing.`);
  process.exit(1);
}

console.log(`\n· ${stopsSeen} focus stops examined across ${pagesSwept} page loads`);

if (problems.length > 0) {
  console.error(`\n❌ ${problems.length} keyboard/focus problems:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`\n✅ No keyboard traps, invisible focus stops, or focus-order breaks across ${ROUTES.length} pages × 2 themes`);
