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
import dataDependent from '../e2e/data-dependent-routes.json' with { type: 'json' };
import { resolveBase } from './lib/audit-base.mjs';
import { chromiumLaunchOptions } from './lib/audit-browser.mjs';

// Defaults to 3100, unlike its siblings — kept, since callers rely on it.
const BASE = resolveBase(process.argv, 'http://127.0.0.1:3100');

// Preflight the target before sweeping.
//
// Without this, pointing at a port with nothing on it does not fail — every page
// merely records `ERROR ... ERR_CONNECTION_REFUSED` and the run ends with
// "222 finding(s)", which reads like the site is catastrophically broken rather
// than like the audit never connected. (That is exactly what happened: the default
// here is 3100, a server was running on 3000, and two full sweeps were spent before
// the cause was obvious.) Fail fast and say which URL was tried.
try {
  const probe = await fetch(BASE, { method: 'HEAD' });
  if (!probe.ok && probe.status >= 500) {
    console.error(`✗ ${BASE} responded ${probe.status}. Start the app first, or pass --base <url>.`);
    process.exit(2);
  }
} catch (error) {
  console.error(
    `✗ Nothing is listening on ${BASE} (${error.code ?? error.message}).\n` +
    '  Start the app (`npm start` from apps/web) or pass --base <url>.\n' +
    '  Not sweeping — every page would report a connection error and look like a finding.',
  );
  process.exit(2);
}

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

const browser = await chromium.launch(chromiumLaunchOptions());
let findings = 0;
const notes = new Set();

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
        let response;
        try {
          response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 25000 });
        } catch (navigationError) {
          if (dataDependent.includes(path)) {
            console.log(`· ${vp.name}/${theme} ${path} — SKIPPED (needs seeded data; navigation failed)`);
            continue;
          }
          throw navigationError;
        }
        // Measure the page we asked for, or report it — never something we were
        // sent to. A redirect to /login (or to an SSO wall on an external target)
        // otherwise gets measured as if it were this route, and passes.
        //
        // A 404 is served AT the requested path, so it passes the redirect check
        // below and gets measured as a swept route. See the longer note in
        // audit-contrast.mjs.
        const status = response?.status() ?? 0;
        // A data-dependent route 404s on any database without the fixture it
        // needs. audit-a11y, audit-mobile, audit-page-images and e2e/data-routes
        // ALL already treat these as skipped rather than failed; this sweep was
        // the only one that did not, so it went red on every run against a
        // database without the stub fixtures — and a permanently-red audit is an
        // ignored audit, which is exactly how a real light-mode contrast bug
        // once reached production under a passing-by-default spec.
        if (status >= 400 && dataDependent.includes(path)) {
          console.log(`· ${vp.name}/${theme} ${path} — SKIPPED (needs seeded data, HTTP ${status})`);
          continue;
        }
        if (status !== 200) {
          console.log(`\u2717 ${vp.name}/${theme} ${path} — HTTP ${status}; not measured`);
          findings++;
          continue;
        }
        const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
        const asked = path.replace(/\/$/, '') || '/';
        if (landed !== asked) {
          console.log(`✗ ${vp.name}/${theme} ${path} — REDIRECTED to ${landed}; not measured`);
          findings++;
          continue;
        }
        // Refuse to measure an UNSTYLED page.
        //
        // audit-mobile.mjs has carried this guard for a while; this script did
        // not, and it cost a full sweep on 2026-08-01: three orphaned
        // `next-server` processes were serving stale HTML against a rebuilt
        // .next, the stylesheet 404'd/400'd, and this audit reported 46 layout
        // defects across 18 routes. Every one was an unstyled element at its
        // intrinsic size — including a "fixed" homepage that only looked fixed
        // because there was no CSS to lay it out wrongly.
        //
        // A sweep against an unstyled page is not a failed sweep. It is a
        // confidently wrong one, and it reads exactly like a real regression.
        const ruleCount = await page.evaluate(() =>
          [...document.styleSheets].reduce((n, sheet) => {
            try { return n + sheet.cssRules.length; } catch { return n; }
          }, 0),
        );
        if (ruleCount === 0) {
          console.log(`✗ ${vp.name}/${theme} ${path} — stylesheet has 0 rules; page is UNSTYLED, refusing to measure`);
          findings++;
          continue;
        }

        // Readiness gate, not a guess.
        //
        // `domcontentloaded` fires before stylesheets and webfonts are applied, so
        // a fixed sleep is a race: under CPU contention (five dev servers running)
        // this sweep measured UNSTYLED pages and reported **84–86 phantom
        // "overlapping controls"**, varying run to run, where a single-server run
        // reproducibly reported 0. Someone would have spent a day chasing layout
        // bugs that do not exist — the false-positive mirror of the vacuous passes
        // recorded elsewhere in this file.
        //
        // Waiting for `load` (stylesheets in) plus `document.fonts.ready` (metrics
        // final) makes the measurement deterministic, because overlap detection is
        // entirely a function of text metrics.
        //
        // Both waits are BOUNDED. `load` does not fire in a sandbox whose Chromium
        // does not inherit HTTPS_PROXY, because external subresources never
        // settle, and `document.fonts.ready` then stays pending forever — a
        // pending promise, not a rejection, so the `.catch` below cannot end it.
        // Unbounded, this sweep hung at 0.1% CPU with no output and had to be
        // killed; an audit that can hang indefinitely is an audit nobody runs.
        // Degrading to a slightly less settled measurement beats never finishing.
        await page.waitForLoadState('load', { timeout: 8_000 }).catch(() => {});
        await Promise.race([
          page.evaluate(() => document.fonts?.ready ?? Promise.resolve()).catch(() => {}),
          page.waitForTimeout(5_000),
        ]);
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
          // Broken images, split by origin.
          //
          // Chromium here does not inherit HTTPS_PROXY, so every CROSS-ORIGIN
          // image (campaign covers on Supabase storage) fails to load in the
          // browser while fetching fine over curl — 200, image/webp, 83KB.
          // Reporting those as broken is a phantom finding that sends the next
          // agent chasing a storage bug that does not exist. Same-origin failures
          // are still real and still reported.
          const brokenAll = [...document.images].filter((i) => i.complete && i.naturalWidth === 0);
          const isSameOrigin = (i) => {
            try { return new URL(i.currentSrc || i.src, location.href).origin === location.origin; }
            catch { return true; }
          };
          const badImgs = brokenAll.filter(isSameOrigin).map((i) => (i.currentSrc || i.src || '').slice(-48));
          const crossOriginUnverifiable = brokenAll.length - badImgs.length;

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

          // Content painted PAST the right edge.
          //
          // The two checks above both missed an entire class of real bug:
          //
          //  - `de.scrollWidth` is defeated by `html, body { overflow-x: hidden }`,
          //    which this stylesheet sets. The document then reports exactly the
          //    viewport width no matter how far content spills, so the page reads
          //    as clean while the overflow is merely CLIPPED — strictly worse than
          //    scrolling, because the content is unreachable. Measured on
          //    /ai-fundraising at 320px: 26 elements painted out to 410px,
          //    including the h1 and both CTA buttons, with `overflow` reading 0.
          //
          //  - `b.width > vw` only catches elements WIDER than the viewport. A
          //    narrow element pushed sideways is invisible to it — on
          //    /success-stories a 90px div sat at x=257, so it ended at 347px on a
          //    320px screen while being nowhere near 320px wide.
          //
          // Decorative layers are excluded: absolutely-positioned, no text. Those
          // are what `overflow-x: hidden` legitimately exists to clip.
          //
          // Content inside a genuinely scrollable ancestor is REACHABLE, not
          // clipped, so it must not be reported. /fast-payouts is the case that
          // proved this: its comparison table paints out to 579px, but it sits in
          // `.fp-table-wrap { overflow-x: auto }` whose own right edge is 302px
          // and whose scrollWidth (560) exceeds its clientWidth (282). That is a
          // correctly built horizontal-scroll region, and this site has several
          // (.kind-pills, .pc-carousel-thumbs). Flagging them would train everyone
          // to ignore this check -- the same way the phantom broken images did.
          const inScrollableRegion = (el) => {
            for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
              const ox = getComputedStyle(n).overflowX;
              if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
            }
            return false;
          };
          const clipped = [];
          for (const el of document.querySelectorAll('body *')) {
            const b = el.getBoundingClientRect();
            if (b.width <= 0 || b.height <= 0 || b.right <= vw + 1) continue;
            const cs = getComputedStyle(el);
            if (cs.position === 'absolute' && !(el.innerText || '').trim()) continue;
            if (inScrollableRegion(el)) continue;
            clipped.push(`${nameOf(el)}@${Math.round(b.right)}`);
            if (clipped.length >= 3) break;
          }

          return { overflow, wide, clipped, badImgs: badImgs.slice(0, 3), crossOriginUnverifiable, overlaps, theme: de.getAttribute('data-theme') };
        });
        const issues = [];
        // The applied theme was already being collected and then thrown away.
        // Assert it: if the attribute does not match what this pass asked for,
        // every colour-dependent finding below describes the OTHER theme, and the
        // run would still print "× 2 themes". That is exactly how
        // e2e/accessibility.spec.ts audited dark twice and never once checked
        // light — the theme was set after load and the ThemeProvider overwrote it.
        if (r.theme !== theme) issues.push(`THEME-NOT-APPLIED: asked ${theme}, rendered ${r.theme ?? 'none'}`);
        if (r.overflow > 2) issues.push(`overflow +${r.overflow}px ${r.wide.join(',')}`);
        if (r.clipped.length) issues.push(`content clipped past viewport: ${r.clipped.join(', ')}`);
        if (r.badImgs.length) issues.push(`broken img (same-origin): ${r.badImgs.join(', ')}`);
        // Not a finding: unverifiable here, and silently dropping it would let a
        // real cross-origin outage hide behind the sandbox's own limitation.
        if (r.crossOriginUnverifiable > 0) notes.add(`${r.crossOriginUnverifiable} cross-origin image(s) unverifiable (browser has no proxy) on ${path}`);
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
// Surfaced, never counted as a finding: an empty notes list would otherwise be
// indistinguishable from "all cross-origin images verified".
if (notes.size) {
  console.log(`\nℹ️  ${notes.size} note(s) — checks this environment could not perform:`);
  for (const n of notes) console.log(`   · ${n}`);
}
console.log(findings === 0
  ? `\n✅ No responsive/theme regressions across ${PAGES.length} pages × ${VIEWPORTS.length} viewports × ${THEMES.length} themes.`
  : `\n${findings} finding(s).`);
process.exit(findings === 0 ? 0 : 1);
