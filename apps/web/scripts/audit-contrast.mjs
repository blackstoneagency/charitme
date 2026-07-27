#!/usr/bin/env node
/**
 * Runtime text-contrast sweep (WCAG 2.2 AA).
 *
 * Why this exists — the two guards we already had could not see this class of bug:
 *   - `scripts/audit-responsive.mjs` loads every page in both themes, but only
 *     measures overflow and images. Light-on-light text has the right width and
 *     working images, so it passes silently.
 *   - `__tests__/theme-tokens.test.ts` greps SOURCE for hardcoded colours, so it
 *     cannot see a pairing that is only wrong once the cascade resolves — e.g.
 *     themed `var(--t1)` text sitting inside a hardcoded-light container.
 *
 * This one renders each route in both themes and measures the COMPUTED colour of
 * every visible text node against its EFFECTIVE background (walking ancestors up
 * through transparent fills), which is the only way to catch the resolved pairing.
 *
 *   node scripts/audit-contrast.mjs [--base http://127.0.0.1:3000] [--json]
 *
 * Exits 1 on any AA failure so it can gate CI.
 *
 * KNOWN BLIND SPOT — text sitting on a background-image or gradient is skipped,
 * because contrast against a photo is not a single number and reporting one
 * produces false positives. The cost is real: a hardcoded-light *gradient* card
 * with themed text (features/page.tsx had one) is invisible to this sweep. When
 * you tokenise a card, check its gradient stops too — `linear-gradient(…,
 * var(--s2), var(--s3))` works and keeps the light rendering identical.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const argv = process.argv;
const baseIdx = argv.indexOf('--base');
// Defaults to 3000 (a plain `next start`). The responsive audit defaults to 3100,
// which has burned a previous run: pointing it at 3000 yields a wall of identical
// ERR_CONNECTION_REFUSED lines that read like real findings.
const BASE = baseIdx > -1 ? argv[baseIdx + 1] : 'http://127.0.0.1:3000';
const AS_JSON = argv.includes('--json');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx > -1 ? argv[onlyIdx + 1].split(',') : null;

// Single source of truth: e2e/public-routes.json, shared with the e2e sweeps and
// scripts/audit-responsive.mjs.
//
// This used to be a hardcoded copy carrying the comment "kept in sync ... so the
// three sweeps cannot drift apart" — via a hand-maintained duplicate, which is
// precisely how they drifted. It listed /achievements and /privacy-center as
// public while both call requireUser() and 307 to /login, so this sweep measured
// the LOGIN PAGE's contrast twice and counted it as two clean marketing pages.
// Its "38 pages, 0 failures" figure included those two scans.
const ROUTE_DATA = JSON.parse(
  readFileSync(fileURLToPath(new URL('../e2e/public-routes.json', import.meta.url)), 'utf8'),
);
// The campaign-embed fixture needs seeded data; the e2e sweep covers it.
const ALL_PAGES = ROUTE_DATA.public.filter((r) => !r.includes('/embed'));
const PAGES = ONLY ?? ALL_PAGES;
const THEMES = ['light', 'dark'];

// Runs in the page. Returns one entry per failing text node.
function collectContrast() {
  const parseRGB = (s) => {
    const m = String(s).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  // Composite a possibly-translucent colour over an opaque backdrop.
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const f = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  // The effective background: walk up until an opaque colour is found, compositing
  // translucent layers on the way. Elements over an image/gradient are skipped —
  // contrast against a photo is not a single number and would be a false positive.
  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unknown: true };
      const bg = parseRGB(cs.backgroundColor);
      if (bg && bg.a > 0) {
        acc = acc ? over(acc, bg) : bg;
        if (acc.a >= 0.999) return acc;
      }
      node = node.parentElement;
    }
    return acc && acc.a >= 0.999 ? acc : { r: 255, g: 255, b: 255, a: 1 };
  };

  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.nodeValue.trim();
    if (text.length < 3) continue;
    const el = n.parentElement;
    if (!el) continue;
    const tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TITLE') continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.15) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const fg = parseRGB(cs.color);
    if (!fg || fg.a < 0.15) continue;
    const bg = effectiveBg(el);
    if (bg.unknown) continue; // sits on an image/gradient — not a single ratio

    const composited = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(composited, bg);

    // WCAG large text: >=24px, or >=18.66px when bold.
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = isLarge ? 3 : 4.5;
    if (r >= need) continue;

    // Dedupe by selector+colour pairing so one repeated component reports once.
    const key = `${tag}.${el.className}|${cs.color}|${cs.fontSize}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      text: text.slice(0, 60),
      tag,
      cls: String(el.className || '').slice(0, 60),
      color: cs.color,
      bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
      size,
      weight,
      ratio: Math.round(r * 100) / 100,
      need,
    });
  }
  return out;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const results = [];
let failures = 0;
let connErrors = 0;
// Elements actually examined, per page. A contrast sweep can only fail on text
// it can see, and large parts of these pages are DATA-CONDITIONAL — e.g.
// /ai-fundraising renders its whole campaign showcase behind
// `{showcase.length > 0 && …}`. Swept against a server with no database those
// sections do not exist, so the sweep reports clean without having looked at
// them. That is how a real 2.56:1 failure inside `.aif-showcase-meta` survived
// every previous "0 violations" run. Reporting the sample size makes an empty
// shell visibly different from a populated page instead of identical.
const sampled = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  // The app reads its own attribute from localStorage, not just the OS setting.
  await ctx.addInitScript((t) => {
    try { localStorage.setItem('charitme-theme-v2', t); } catch { /* ignore */ }
  }, theme);
  const page = await ctx.newPage();

  for (const path of PAGES) {
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      // Measure the page we asked for, or report it — never something we were sent
      // to. Playwright follows redirects, so a route that 307s to /login otherwise
      // gets measured under this route's name and passes on the login page's colours.
      const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
      const asked = path.replace(/\/$/, '') || '/';
      if (landed !== asked) {
        failures++;
        if (!AS_JSON) console.log(`\u2717 ${theme} ${path} — REDIRECTED to ${landed}; not measured`);
        continue;
      }
      await page.waitForTimeout(350); // let the theme script + fonts settle
      const textCount = await page.evaluate(() => {
        let n = 0;
        for (const el of document.querySelectorAll('body *')) {
          if (!(el instanceof HTMLElement)) continue;
          const t = el.textContent?.trim();
          if (!t || el.children.length > 0) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none') continue;
          n++;
        }
        return n;
      });
      sampled.push({ theme, path, textCount });
      const found = await page.evaluate(collectContrast);
      for (const f of found) {
        failures++;
        results.push({ theme, path, ...f });
        if (!AS_JSON) {
          console.log(
            `✗ ${theme.padEnd(5)} ${path} — ${f.ratio}:1 (need ${f.need}) ` +
            `${f.color} on ${f.bg} · ${f.size}px/${f.weight} · <${f.tag}> "${f.text}"`,
          );
        }
      }
    } catch (e) {
      const msg = String(e.message);
      if (msg.includes('ERR_CONNECTION')) connErrors++;
      if (!AS_JSON) console.log(`✗ ${theme}/${path} — ERROR ${msg.slice(0, 80)}`);
    }
  }
  if (!AS_JSON) {
    const forTheme = sampled.filter((r) => r.theme === theme);
    const total = forTheme.reduce((sum, r) => sum + r.textCount, 0);
    console.log(`· ${theme}: swept ${PAGES.length} pages, ${total.toLocaleString()} text elements examined`);
  }
  await ctx.close();
}
await browser.close();

// A page that rendered almost nothing was not meaningfully audited. This does not
// fail the run — an empty state can be legitimate — but it must be SAID, so a
// green result is never mistaken for coverage the sweep did not have.
const THIN = Number(process.env.CONTRAST_THIN_THRESHOLD ?? 15);
const thin = sampled.filter((r) => r.textCount < THIN);
if (!AS_JSON && thin.length > 0) {
  console.log(`\n⚠ ${thin.length} page render(s) had fewer than ${THIN} text elements — likely an empty`);
  console.log('  data state, so any data-conditional section on them went unchecked:');
  for (const r of thin) console.log(`    ${r.theme.padEnd(5)} ${r.path} — ${r.textCount}`);
  console.log('  Re-run against a server with database credentials to audit those sections.');
}

if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2));
} else if (connErrors > 0) {
  // Guard against the failure mode that already burned one audit run: a wrong
  // --base makes every page "fail" identically, which reads like a real regression.
  console.log(`\n⚠️  ${connErrors} connection error(s) — is the server up on ${BASE}? Findings above are not real.`);
} else {
  console.log(
    failures === 0
      ? `\n✅ No AA contrast failures across ${PAGES.length} pages × ${THEMES.length} themes`
      : `\n❌ ${failures} contrast failure(s)`,
  );
}
process.exit(failures > 0 || connErrors > 0 ? 1 : 0);
