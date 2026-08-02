// Mobile layout audit: no page may scroll horizontally on a phone.
//
//   node scripts/audit-mobile.mjs [baseUrl] [--auth] [--only /a,/b]
//
// `--auth` additionally sweeps the SIGNED-IN routes — /dashboard/*, /admin/* and
// the gated pages outside them — using the stub session in STUB_SESSION_COOKIE,
// exactly as audit-contrast.mjs does. Without it this audit covers the public
// site only, which is roughly a third of the app's screens and not the third
// where wide data tables live. Run it through `npm run audit:mobile:signed-in`,
// which builds against the stub and mints the cookie.
//
// A page wider than the viewport is the single most visible mobile defect —
// text runs off the edge and the whole layout slides sideways. PR #49 and PR
// #127 each fixed this on /ai-fundraising, the second time as a REGRESSION,
// because the check lived in a session transcript rather than in a script. This
// makes it repeatable.
//
// 320px is the narrowest phone still in use (iPhone SE 1st gen); 390px is a
// current iPhone. Both are checked because a layout can pass one and fail the
// other.
//
// When a page overflows, the offending elements are named with their widths —
// a bare "page is 410px" tells you nothing about which node did it. Follows
// audit-a11y.mjs: a page that never loaded is a failed audit, not a silent pass.
import { chromium } from 'playwright';
import routes from '../e2e/public-routes.json' with { type: 'json' };
import dataDependent from '../e2e/data-dependent-routes.json' with { type: 'json' };
import { resolveBase } from './lib/audit-base.mjs';

const argv = process.argv;
const WITH_AUTH = argv.includes('--auth');
const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const ONLY = onlyArg ? onlyArg.split(',').map((x) => x.trim()).filter(Boolean) : null;

const publicList = Array.isArray(routes) ? routes : (routes.routes ?? routes.public ?? []);

// The gated surface, from the same single source the e2e sweeps use. These are
// only swept with a session: without one every route 307s to /login, and the
// sweep would measure the login page under eighty different names and pass.
const gatedList = (!Array.isArray(routes) && routes.authGated)
  ? [
    ...(routes.authGated.routes ?? []),
    ...(routes.authGated.consoles ?? []),
    ...(routes.authGated.dynamicSamples ?? []).map((sample) => sample.path),
  ]
  : [];

const sessionCookie = process.env.STUB_SESSION_COOKIE
  ? JSON.parse(process.env.STUB_SESSION_COOKIE)
  : null;

if (WITH_AUTH && !sessionCookie) {
  console.error(
    '✗ --auth was passed but STUB_SESSION_COOKIE is not set.\n' +
    '  Every gated route would redirect to /login and be measured under the wrong\n' +
    '  name. Run `npm run audit:mobile:signed-in` instead of this script directly.',
  );
  process.exit(2);
}

let list = WITH_AUTH ? [...publicList, ...gatedList] : publicList;
if (ONLY) list = list.filter((r) => ONLY.includes(typeof r === 'string' ? r : r.path));
if (list.length === 0) {
  console.error('✗ no routes selected — refusing to report a clean run over nothing.');
  process.exit(2);
}

const BASE = resolveBase(process.argv);
const WIDTHS = [320, 390];

// WCAG 2.2 SC 2.5.8 "Target Size (Minimum)", Level AA: 24×24 CSS px. The spec's
// exceptions are honoured — inline targets inside a sentence, and targets with
// enough surrounding spacing, both pass — because flagging every inline link
// would bury the real defects under noise nobody would read.
const MIN_TARGET = 24;

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const failures = [];
const tapFailures = [];
const errors = [];
let analyzed = 0;

for (const width of WIDTHS) {
  const ctx = await b.newContext({
    viewport: { width, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  if (sessionCookie) {
    await ctx.addCookies([{ name: sessionCookie.name, value: sessionCookie.value, url: BASE }]);
  }
  const page = await ctx.newPage();

  for (const r of list) {
    const path = typeof r === 'string' ? r : r.path;
    try {
      const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(350);

      // A missing route is not an unstyled one. Next's 404 ships almost no CSS,
      // so the styled===0 check below caught it and reported "page is unstyled,
      // refusing to measure" — a true statement about a completely different
      // problem. The route list referenced a campaign fixture slug that does not
      // exist in every database, so this audit exited 1 on every run while the
      // real sweep was clean. A permanently-red audit is an ignored audit.
      const status = response?.status() ?? 0;
      // A data-dependent route 404s on a database without the fixture it needs.
      // e2e/data-routes.ts already established that these are SKIPPED rather than
      // failed; sharing the list means this audit agrees with the e2e sweep
      // instead of exiting 1 on every run for a route the suite deliberately
      // tolerates. Skipped, not counted as analyzed — it was not measured.
      if (status === 404 && dataDependent.includes(path)) {
        console.log(`· ${width}px ${path} — SKIPPED (needs seeded data, HTTP 404)`);
        continue;
      }
      if (status >= 400) {
        errors.push(`${width}px ${path} (HTTP ${status})`);
        console.log(`! ${width}px ${path} — HTTP ${status}; route did not render, nothing to measure`);
        continue;
      }

      // Measure the page we asked for, never the one we were sent to. A gated
      // route that 307s to /login otherwise gets measured AS that route and
      // passes — which is how a sweep of eighty consoles becomes eighty clean
      // readings of the login page.
      const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
      const asked = path.replace(/\/$/, '') || '/';
      if (landed !== asked) {
        errors.push(`${width}px ${path} (redirected to ${landed})`);
        console.log(`! ${width}px ${path} — REDIRECTED to ${landed}; not measured`);
        continue;
      }

      // Refuse to measure an UNSTYLED page. Layout audits are meaningless
      // without CSS, and they do not fail quietly — they fail *loudly and
      // wrongly*: a stale `next start` serving old HTML against a rebuilt
      // `.next` returned 400 for the CSS bundle, and this script then reported
      // 4 overflows and 42 tap-target violations that did not exist. Every
      // "defect" was an unstyled element at its intrinsic size.
      //
      // One cheap check separates the two: a loaded stylesheet has rules.
      const styled = await page.evaluate(() =>
        [...document.styleSheets].reduce((n, s) => {
          try { return n + s.cssRules.length; } catch { return n; }
        }, 0),
      );
      if (styled === 0) {
        errors.push(`${width}px ${path} (no CSS)`);
        console.log(`! ${width}px ${path} — stylesheet has 0 rules; page is unstyled, refusing to measure`);
        continue;
      }

      analyzed++;

      const result = await page.evaluate((vw) => {
        const doc = document.documentElement;
        const scrollW = Math.max(doc.scrollWidth, document.body.scrollWidth);
        if (scrollW <= vw + 1) return null;

        // Name the elements that actually WIDEN THE PAGE.
        //
        // Crossing the viewport edge is not the same thing. A wide table inside
        // an `overflow-x: auto` scroller crosses it by design and moves the page
        // not at all — and this audit used to report exactly that, which is how
        // /dashboard/donations was blamed on a 720px `.kf-row` while its document
        // measured 417. Four innocent elements were named and the real culprit
        // was in none of them, so every fix aimed at this output missed.
        //
        // An element is excused only when a NON-ROOT ancestor clips it.
        //
        // `html` and `body` both carry `overflow-x: hidden` in globals.css, so
        // walking all the way to the root excuses every element on every page —
        // which is exactly what happened, and turned a 13-route report into
        // thirteen "no unclipped element" shrugs. That root rule is not a
        // scroller: it stops the page sliding sideways and CLIPS the overflow
        // instead, leaving the content cut off at the right edge with no way to
        // reach it. Still a defect, and the one being measured here. Only a
        // deliberate inner scroller — a table wrapper, a tab strip — excuses an
        // element.
        const clips = (el) => {
          for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
          }
          return false;
        };

        const guilty = [];
        for (const el of document.querySelectorAll('body *')) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.right <= vw + 1) continue;
          if (clips(el)) continue;
          guilty.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || '').toString().slice(0, 48),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
        guilty.sort((a, c) => c.right - a.right);
        // Keep the outermost few; children inherit their parent's overflow.
        return { scrollW, guilty: guilty.slice(0, 4), unattributed: guilty.length === 0 };
      }, width);

      // Tap targets — only at the narrowest width, where they are tightest.
      if (width === WIDTHS[0]) {
        const small = await page.evaluate((min) => {
          const out = [];
          const sel = 'a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"]';
          for (const el of document.querySelectorAll(sel)) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
            // Measure the EFFECTIVE target. A checkbox inside (or named by) a
            // <label> is activated by clicking the label, so the label's box is
            // what a thumb has to hit. Measuring the 16×16 input instead would
            // report a failure that isn't one — and "fixing" it would enlarge a
            // control that was already easy to tap.
            let target = el;
            const labelled = el.closest('label')
              || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
            if (labelled) {
              const lr = labelled.getBoundingClientRect();
              const er = el.getBoundingClientRect();
              if (lr.width >= er.width && lr.height >= er.height) target = labelled;
            }

            const r = target.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.bottom < 0 || r.top > (window.innerHeight * 4)) continue; // ignore far-offscreen
            if (r.width >= min && r.height >= min) continue;

            // Exception: a target inline within a sentence of text.
            const parent = el.parentElement;
            const inlineInText =
              cs.display.startsWith('inline') &&
              parent &&
              (parent.textContent || '').trim().length > (el.textContent || '').trim().length + 12;
            if (inlineInText) continue;

            // Exception: sufficient spacing — no other target within the 24px
            // circle the spec allows in place of raw size.
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            let crowded = false;
            for (const other of document.querySelectorAll(sel)) {
              if (other === el) continue;
              const o = other.getBoundingClientRect();
              if (o.width === 0 || o.height === 0) continue;
              const dx = Math.max(o.left - cx, 0, cx - o.right);
              const dy = Math.max(o.top - cy, 0, cy - o.bottom);
              if (Math.hypot(dx, dy) < min) { crowded = true; break; }
            }
            if (!crowded) continue;

            out.push({
              tag: el.tagName.toLowerCase(),
              via: target === el ? '' : ` (via <${target.tagName.toLowerCase()}>)`,
              cls: (el.className || '').toString().slice(0, 40),
              label: (el.getAttribute('aria-label') || target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
          return out;
        }, MIN_TARGET);

        if (small.length) {
          tapFailures.push({ path, count: small.length, sample: small.slice(0, 3) });
          console.log(`✗ tap ${path} — ${small.length} target(s) under ${MIN_TARGET}px`);
          for (const s of small.slice(0, 3)) {
            console.log(`      <${s.tag}>${s.via} "${s.label}" ${s.w}×${s.h} class="${s.cls}"`);
          }
        }
      }

      if (result) {
        failures.push({ path, width, ...result });
        // Named for what a phone actually shows. `overflow-x: hidden` at the root
        // means the page does not slide sideways — the extra width is cut off
        // and unreachable, which is why "content clipped" is the honest word and
        // "page scrolls" would have been wrong on every one of these routes.
        console.log(`✗ ${width}px ${path} — content is ${result.scrollW}px wide, clipped at ${width}px`);
        for (const g of result.guilty) {
          console.log(`      <${g.tag}> class="${g.cls}" width=${g.width} right=${g.right}`);
        }
        if (result.unattributed) {
          // Said out loud rather than printed as an empty list. The page IS wider
          // than the viewport, but every element crossing the edge sits inside a
          // horizontal scroller — so the cause is a margin, a transform, or a
          // pseudo-element, none of which have a box in `body *`.
          console.log('      (no unclipped element crosses the edge — look for a negative margin, a transform, or a ::before)');
        }
      }
    } catch (e) {
      errors.push(`${width}px ${path}`);
      console.log(`! ${width}px ${path} — ${String(e.message).slice(0, 60)}`);
    }
  }
  await ctx.close();
  console.log(`· ${width}px: swept ${list.length} routes${WITH_AUTH ? ' (public + signed-in)' : ' (public only)'}`);
}
await b.close();

if (errors.length) {
  console.log(`\n⚠️  ${errors.length} page load(s) failed — is the server up on ${BASE}?`);
  console.log(`   Only ${analyzed} page(s) were analyzed, so a clean result here would be meaningless.`);
  process.exit(1);
}

const tapTotal = tapFailures.reduce((a, t) => a + t.count, 0);

if (failures.length) {
  console.log(`\n${failures.length} horizontal overflow(s) across ${analyzed} page loads.`);
}
if (tapTotal) {
  console.log(`\n${tapTotal} tap target(s) under ${MIN_TARGET}px on ${tapFailures.length} route(s) (WCAG 2.2 SC 2.5.8, AA).`);
}
if (failures.length || tapTotal) process.exit(1);

console.log(`\n✅ No horizontal overflow across ${analyzed} page loads (${list.length} routes × ${WIDTHS.length} widths${WITH_AUTH ? ', public + signed-in' : ', public only'})`);
console.log(`✅ No tap targets under ${MIN_TARGET}px at ${WIDTHS[0]}px (WCAG 2.2 SC 2.5.8)`);
