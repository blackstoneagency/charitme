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
 * GRADIENTS ARE SCORED, PHOTOS ARE NOT. A real image (`url(...)`) is skipped:
 * contrast against a photo is not a single number and reporting one produces
 * false positives. A gradient is different — its colour stops are enumerable, so
 * this scores the LEAST favourable stop, because text that is readable at one end
 * of a fill and not the other is still unreadable somewhere. This closed a real
 * blind spot: a hardcoded-light *gradient* card with themed text in
 * features/page.tsx was invisible to the earlier version and had to be found by
 * eye (`linear-gradient(…, var(--s2), var(--s3))` is the fix that keeps light
 * rendering identical).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { resolveBase } from './lib/audit-base.mjs';
import { resolveChromium } from './lib/audit-browser.mjs';

const argv = process.argv;
// Defaults to 3000 (a plain `next start`). The responsive audit defaults to 3100,
// which has burned a previous run: pointing it at 3000 yields a wall of identical
// ERR_CONNECTION_REFUSED lines that read like real findings.
const BASE = resolveBase(argv);
const AS_JSON = argv.includes('--json');
const onlyIdx = argv.indexOf('--only');
const ONLY = onlyIdx > -1 ? argv[onlyIdx + 1].split(',') : null;
// Gradient findings are reported but do NOT fail the run by default. They are real
// (white on the pink end of a brand CTA measures ~3.5:1), but fixing them means
// changing the brand gradients — a design decision, not a lint fix. Failing the
// build on them would have taken CI from green to 66 red on a judgement call
// nobody had made yet. `--strict-gradients` opts in once that call is made.
const STRICT_GRADIENTS = argv.includes('--strict-gradients');

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
// ─── signed-in sweep ─────────────────────────────────────────────────────────
//
// `--auth` adds the gated half of the product: 10 standalone gated routes,
// 68 renderable static console routes, and one populated instantiation of each
// of the 19 signed-in [param] templates. Those are routes which no contrast,
// axe or responsive
// sweep has ever measured — the tracker recorded them as blocked on "egress to
// Supabase", which was a misdiagnosis: the sweeps need A Supabase, not THE
// Supabase. `scripts/supabase-stub.mjs` is one, and `scripts/audit-signed-in.mjs`
// wires it up.
//
// This flag does NOT mint a session on its own. It expects the caller to have
// exported STUB_SESSION_COOKIE; without it every gated route redirects to /login
// and the run fails loudly on the redirect guard below rather than quietly
// measuring the login page 97 times.
const WITH_AUTH = argv.includes('--auth');
const SESSION_COOKIE = process.env.STUB_SESSION_COOKIE ?? '';

// The campaign-embed fixture needs seeded data; the e2e sweep covers it.
const ALL_PAGES = ROUTE_DATA.public.filter((r) => !r.includes('/embed'));
const GATED_PAGES = [
  ...ROUTE_DATA.authGated.routes,
  ...ROUTE_DATA.authGated.consoles,
  ...ROUTE_DATA.authGated.dynamicSamples.map((sample) => sample.path),
];
const PAGES = ONLY ?? (WITH_AUTH ? [...ALL_PAGES, ...GATED_PAGES] : ALL_PAGES);
const THEMES = ['light', 'dark'];

if (WITH_AUTH && !SESSION_COOKIE) {
  console.error(
    '--auth needs STUB_SESSION_COOKIE in the environment. Run scripts/audit-signed-in.mjs,\n' +
    'which starts the stub, mints the cookie and sets it for you.',
  );
  process.exit(2);
}

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

  // A gradient is NOT opaque-unknown the way a photo is: its colour stops are
  // enumerable, so the worst case over the whole fill is computable. Returning
  // every stop lets the caller score against the least-favourable one. A real
  // image (`url(...)`) stays unknown — contrast against a photo is not a number.
  const gradientStops = (backgroundImage) => {
    if (!backgroundImage.includes('gradient(')) return null;
    const stops = [...backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
      .map((m) => parseRGB(m[0]))
      .filter((c) => c && c.a > 0.5); // near-transparent stops reveal what's under
    return stops.length ? stops : null;
  };

  // The effective background: walk up until an opaque colour is found, compositing
  // translucent layers on the way. Elements over a real image are skipped; over a
  // gradient we keep every stop and score against the worst.
  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        // `background-clip: text` paints the gradient INTO the glyphs — it is the
        // text colour, not a backdrop behind it. Scoring text against it compares
        // the glyphs to themselves and invents failures (the /features hero
        // headline reported 2.46:1 that way). Keep walking to the real backdrop.
        const clip = cs.webkitBackgroundClip || cs.backgroundClip;
        if (clip === 'text') { node = node.parentElement; continue; }
        const stops = gradientStops(cs.backgroundImage);
        if (!stops) return { unknown: true }; // url(...) — a photo, not scoreable
        // Composite any translucent layers collected so far over each stop.
        return { stops: acc ? stops.map((s) => over(acc, s)) : stops };
      }
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

    // Gradient-filled text (`-webkit-text-fill-color: transparent` + a clipped
    // background) does not render in `cs.color`, so scoring that value measures a
    // colour nobody sees. Its real contrast varies along the gradient and needs a
    // human call, not a single ratio.
    const fillColor = cs.webkitTextFillColor || '';
    if (fillColor.includes('rgba(0, 0, 0, 0)') || fillColor === 'transparent') continue;

    const fg = parseRGB(cs.color);
    if (!fg || fg.a < 0.15) continue;
    const bgResult = effectiveBg(el);
    if (bgResult.unknown) continue; // sits on a real image — not a single ratio

    // Over a gradient, score the LEAST favourable stop: text that is readable at
    // one end of the fill and not the other is still unreadable somewhere.
    const candidates = bgResult.stops ?? [bgResult];
    let bg = candidates[0];
    let r = Infinity;
    let rMax = -Infinity;
    for (const c of candidates) {
      const composited = fg.a < 1 ? over(fg, c) : fg;
      const cr = ratio(composited, c);
      if (cr < r) { r = cr; bg = c; }
      if (cr > rMax) rMax = cr;
    }

    // Gradient findings are REPORTED rather than failed, because fixing them
    // means changing a brand gradient — a design call. That leniency only makes
    // sense when the ratio actually varies along the fill. It does not when an
    // opaque layer sits between the text and the gradient: every stop composites
    // to nearly the same colour, so the failure is an ordinary solid-background
    // failure wearing a gradient's clothes.
    //
    // Real case: `.aif-showcase-cat` ("Medical") on /ai-fundraising in dark —
    // rgb(108,53,255) on a 96%-opaque rgba(18,21,52,.96) card at 11px/950,
    // measured 3.04:1 against a required 4.5:1. The card's ancestor carries a
    // gradient contributing ~4%, which was enough to downgrade a genuine AA
    // failure to a non-failing warning.
    const GRADIENT_SPREAD_EPSILON = 0.5;
    const overGradient = Boolean(bgResult.stops) && rMax - r >= GRADIENT_SPREAD_EPSILON;

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
      overGradient,
    });
  }
  return out;
}

const browserExecutable = resolveChromium();

const browser = await chromium.launch({
  ...(browserExecutable ? { executablePath: browserExecutable } : {}),
  args: ['--no-sandbox'],
});
const results = [];
let failures = 0;
let gradientFindings = 0;
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
  if (SESSION_COOKIE) {
    // Cookie name is derived by supabase-js as `sb-<hostname-first-label>-auth-token`,
    // so it follows whatever NEXT_PUBLIC_SUPABASE_URL the build was made against.
    // audit-signed-in.mjs computes both the name and the value and passes them here.
    const { name, value } = JSON.parse(SESSION_COOKIE);
    await ctx.addCookies([{ name, value, url: BASE }]);
  }
  const page = await ctx.newPage();

  if (WITH_AUTH && theme === THEMES[0]) {
    for (const expected of ROUTE_DATA.authGated.redirects) {
      try {
        const response = await page.goto(BASE + expected.from, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        const wantedUrl = new URL(expected.to, BASE);
        try {
          await page.waitForURL(
            (url) =>
              `${url.pathname}${url.search}` ===
              `${wantedUrl.pathname}${wantedUrl.search}`,
            { timeout: 5000 },
          );
        } catch {
          // The exact landed URL is reported below with the expected target.
        }
        const actualUrl = new URL(page.url());
        const actualTarget = `${actualUrl.pathname}${actualUrl.search}`;
        const wantedTarget = `${wantedUrl.pathname}${wantedUrl.search}`;
        if (!response || response.status() >= 400 || actualTarget !== wantedTarget) {
          failures++;
          if (!AS_JSON) {
            console.log(
              `\u2717 redirect ${expected.from} - landed=${actualTarget}, expected=${wantedTarget}`,
            );
          }
        }
      } catch (error) {
        failures++;
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('ERR_CONNECTION')) connErrors++;
        if (!AS_JSON) {
          console.log(`\u2717 redirect ${expected.from} - ERROR ${message.slice(0, 80)}`);
        }
      }
    }
  }

  for (const path of PAGES) {
    try {
      const response = await page.goto(BASE + path, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      if (!response || response.status() >= 400) {
        failures++;
        const status = response?.status() ?? 'NO_RESPONSE';
        if (!AS_JSON) console.log(`\u2717 ${theme} ${path} - HTTP ${status}; not measured`);
        continue;
      }
      // Measure the page we asked for, or report it — never something we were sent
      // to. Playwright follows redirects, so a route that 307s to /login otherwise
      // gets measured under this route's name and passes on the login page's colours.
      //
      // A 404 slips past the redirect check below, because the not-found page is
      // served AT the requested path. It then gets contrast-audited and counted as
      // a swept route, so coverage goes up while nothing real was measured.
      // `/campaigns/security-header-fixture/embed` is in the public list and 404s
      // on any database without that fixture row (including production) — the e2e
      // specs already probe and skip it via e2e/data-routes.ts; this sweep did not.
      const status = response?.status() ?? 0;
      if (status !== 200) {
        failures++;
        if (!AS_JSON) console.log(`\u2717 ${theme} ${path} — HTTP ${status}; not measured`);
        continue;
      }
      const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
      const asked = path.replace(/\/$/, '') || '/';
      if (landed !== asked) {
        failures++;
        if (!AS_JSON) console.log(`\u2717 ${theme} ${path} — REDIRECTED to ${landed}; not measured`);
        continue;
      }
      await page.waitForTimeout(350); // let the theme script + fonts settle
      const activeTheme = await page.evaluate(
        () => document.documentElement.getAttribute('data-theme'),
      );
      if (activeTheme !== theme) {
        failures++;
        if (!AS_JSON) {
          console.log(
            `\u2717 ${theme} ${path} - theme reverted to "${activeTheme}"; not measured`,
          );
        }
        continue;
      }
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
        if (f.overGradient && !STRICT_GRADIENTS) gradientFindings++; else failures++;
        results.push({ theme, path, ...f });
        if (!AS_JSON) {
          console.log(
            `${f.overGradient && !STRICT_GRADIENTS ? '⚠' : '✗'} ${theme.padEnd(5)} ${path} — ${f.ratio}:1 (need ${f.need}) ` +
            `${f.color} on ${f.bg} · ${f.size}px/${f.weight} · <${f.tag}>` +
            // The class chain is already captured for deduping — printing it is what
            // turns "some grey text is too light" into a fixable CSS selector.
            `${f.cls ? `.${f.cls.trim().split(/\s+/).join('.')}` : ''} "${f.text}"`,
          );
        }
      }
    } catch (e) {
      failures++;
      const msg = e instanceof Error ? e.message : String(e);
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

const MIN_TEXT = Number(process.env.CONTRAST_MIN_TEXT ?? (WITH_AUTH ? 5 : 1));
const emptyRenders = sampled.filter((result) => result.textCount < MIN_TEXT);
if (emptyRenders.length > 0) {
  failures += emptyRenders.length;
  if (!AS_JSON) {
    console.log(
      `\n\u2717 ${emptyRenders.length} page render(s) had fewer than ${MIN_TEXT} visible text elements`,
    );
    for (const result of emptyRenders) {
      console.log(`    ${result.theme.padEnd(5)} ${result.path} - ${result.textCount}`);
    }
  }
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
      ? `\n✅ No AA contrast failures across ${PAGES.length} pages × ${THEMES.length} themes` +
        (gradientFindings
          ? `\n⚠  ${gradientFindings} finding(s) on GRADIENT fills — reported, not failing. ` +
            `These are real AA misses (white on the pink end of a brand CTA is ~3.5:1), ` +
            `but fixing them changes the brand gradients, which is a design decision. ` +
            `Re-run with --strict-gradients to gate on them once that call is made.`
          : '')
      : `\n❌ ${failures} contrast failure(s)` +
        (gradientFindings ? `\n⚠  plus ${gradientFindings} gradient finding(s) (not gating)` : ''),
  );
}
process.exit(failures > 0 || connErrors > 0 ? 1 : 0);
