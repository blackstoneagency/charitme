// Image-uniqueness audit: no page may show the same photo twice.
//
//   node scripts/audit-page-images.mjs [baseUrl|--base <url>]
//
// scripts/audit-campaign-images.mjs already checks the photo CATALOG — that the
// category→photo mapping resolves and that IDs are not missing. It says nothing
// about what a visitor actually sees, because a page can render one catalog entry
// many times over. This audits the rendered DOM instead.
//
// What counts as a defect: the SAME image appearing more than once on ONE page.
// That is the visible failure — a campaign grid where three cards share a photo
// reads as broken data. Reuse ACROSS pages is reported but not failed: a category
// hero legitimately appears on both the category page and the home rail, and
// failing that would force 40 unrelated photos for no user benefit.
//
// Chrome is excluded, not by guessing at filenames but by role: the site logo,
// avatars and inline SVG data URIs repeat by design. Everything else is content.
import { chromium } from 'playwright';
import routes from '../e2e/public-routes.json' with { type: 'json' };
import dataDependent from '../e2e/data-dependent-routes.json' with { type: 'json' };
import { resolveBase } from './lib/audit-base.mjs';
import { chromiumLaunchOptions } from './lib/audit-browser.mjs';

const argv = process.argv;
const WITH_AUTH = argv.includes('--auth');
const SKIP_ADMIN = process.env.AUDIT_SKIP_ADMIN === '1';
const ONLY_GATED = process.env.AUDIT_ONLY_GATED === '1';
const SKIP_DASHBOARD_ROOT = process.env.AUDIT_SKIP_DASHBOARD_ROOT === '1';
const onlyArg = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const ONLY = onlyArg ? onlyArg.split(',').map((value) => value.trim()).filter(Boolean) : null;
const STRICT_GLOBAL = argv.includes('--strict-global');
const publicList = Array.isArray(routes) ? routes : (routes.routes ?? routes.public ?? []);
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
  console.error('Signed-in image audit requires STUB_SESSION_COOKIE. Run audit:page-images:signed-in.');
  process.exit(2);
}

const signedOutOnly = new Set(routes.signedOutOnly ?? []);
let staticList = WITH_AUTH
  ? [...(ONLY_GATED ? [] : publicList.filter((route) => !signedOutOnly.has(typeof route === 'string' ? route : route.path))), ...gatedList]
  : publicList;
if (ONLY) staticList = staticList.filter((route) => ONLY.includes(typeof route === 'string' ? route : route.path));
if (staticList.length === 0) {
  console.error('No routes selected; refusing to report a clean image run over nothing.');
  process.exit(2);
}
const BASE = resolveBase(process.argv);

// Campaign detail pages are the highest-risk surface for repeated photos — a
// carousel, a similar-campaigns grid and a cover all draw from the same catalog —
// but only a fixture slug is in public-routes.json. Sample real ones from the live
// listing so the sweep covers the pages most likely to duplicate.
const sampleIdx = process.argv.indexOf('--campaigns');
const SAMPLE = sampleIdx > -1 ? Number(process.argv[sampleIdx + 1]) : 8;

async function sampleCampaignRoutes(fetchPage) {
  if (SAMPLE <= 0) return [];
  try {
    await fetchPage.goto(BASE + '/campaigns', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await fetchPage.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    const slugs = await fetchPage.evaluate(() =>
      [...new Set([...document.querySelectorAll('a[href^="/campaigns/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((h) => h && /^\/campaigns\/[^/]+$/.test(h)))],
    );
    return slugs.slice(0, SAMPLE);
  } catch {
    return [];
  }
}

// Two URLs pointing at the same Unsplash photo at different widths ARE the same
// image to a viewer. Comparing raw src would call them distinct and hide exactly
// the duplication this is looking for.
// Generated-avatar services render a person, not page imagery. The same person
// legitimately appears in several sections at once — a team fundraiser who also
// donated shows up in both lists — so counting these as duplicate images reports
// correct behaviour as a defect.
const AVATAR_HOSTS = ['dicebear.com', 'gravatar.com', 'ui-avatars.com'];

function imageIdentity(raw) {
  if (!raw || raw.startsWith('data:')) return null;
  if (AVATAR_HOSTS.some((h) => raw.includes(h))) return null;
  try {
    const u = new URL(raw, BASE);
    // Unsplash: the photo id is the stable part; w/q/auto/fit are presentation.
    const unsplash = u.pathname.match(/photo-([a-z0-9-]+)/i);
    if (unsplash) return `unsplash:${unsplash[1]}`;
    // Next's optimizer wraps the real target in ?url=
    const inner = u.searchParams.get('url');
    if (inner) return imageIdentity(decodeURIComponent(inner));
    const picsum = u.hostname.includes('picsum') && u.pathname.match(/\/id\/(\d+)/);
    if (picsum) return `picsum:${picsum[1]}`;
    // Keep the query for everything else. Stripping it is only safe where the query
    // is PRESENTATION (Unsplash w/q/auto/fit, handled above). For generator services
    // the query IS the image — DiceBear puts the seed there, so dropping it collapsed
    // two different avatars into one identity and reported a duplicate that was two
    // distinct pictures.
    return `${u.hostname}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

const b = await chromium.launch(chromiumLaunchOptions());
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
if (sessionCookie) {
  await ctx.addCookies([{ name: sessionCookie.name, value: sessionCookie.value, url: BASE }]);
}
const page = await ctx.newPage();

const withinPage = [];
const seenAcross = new Map();
const errors = [];
const brokenImages = [];
const placeholderImages = [];
let analyzed = 0;

const sampled = await sampleCampaignRoutes(page);
if (sampled.length === 0 && SAMPLE > 0) {
  console.log('! could not sample campaign detail pages from /campaigns — the highest-risk');
  console.log('  surface is therefore UNMEASURED. Not treating this as a pass.');
  process.exit(1);
}
console.log(`· sampling ${sampled.length} real campaign detail page(s)`);
const list = [...staticList, ...sampled];

for (const r of list) {
  const path = typeof r === 'string' ? r : r.path;
  try {
    const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);

    const status = response?.status() ?? 0;
    if (status >= 400 && dataDependent.includes(path)) {
      console.log(`· ${path} — SKIPPED (needs seeded data, HTTP ${status})`);
      continue;
    }
    if (status >= 400) {
      errors.push(`${path} (HTTP ${status})`);
      console.log(`! ${path} — HTTP ${status}; nothing to measure`);
      continue;
    }

    const asked = path.split('?')[0].replace(/\/$/, '') || '/';
    if (SKIP_ADMIN && asked.startsWith('/admin')) {
      console.log(`SKIP ${path}: admin route under member session`);
      continue;
    }
    if (SKIP_DASHBOARD_ROOT && asked === '/dashboard') {
      console.log(`SKIP ${path}: member landing route under admin session`);
      continue;
    }
    const landed = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
    if (landed !== asked) {
      errors.push(`${path} (redirected to ${landed})`);
      console.log(`! ${path}: redirected to ${landed}; nothing to measure`);
      continue;
    }

    await page.evaluate(async () => {
      const step = Math.max(window.innerHeight * 1.5, 900);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(100);

    const rendered = await page.evaluate(() => {
      const out = [];
      const broken = [];
      for (const el of document.querySelectorAll('img')) {
        // Chrome that repeats by design. Identified by role/alt/class, not by
        // pattern-matching filenames, which breaks the moment an asset is renamed.
        const cls = el.className?.toString?.() ?? '';
        // A thumbnail strip legitimately shows a small copy of the image currently
        // displayed — the carousel main view and its own thumb are the SAME photo by
        // design, and flagging that would have had me "fixing" correct UI. The
        // distinction is control vs content: an in-page <button> is a control, while
        // a campaign card is an <a> that navigates to different content. Excluding
        // buttons keeps the audit blind to carousels and still sensitive to the real
        // defect — a grid of card links sharing one photo.
        const isControl = el.closest('button, [role="button"]') !== null;
        const isChrome =
          el.closest('header, nav, footer') !== null ||
          /logo|avatar|icon/i.test(cls) ||
          /logo|avatar/i.test(el.alt ?? '');
        if (isControl || isChrome) continue;
        const source = el.currentSrc || el.src;
        const entity = el.getAttribute('data-image-entity') ?? el.closest('[data-image-entity]')?.getAttribute('data-image-entity') ?? null;
        if (source) out.push({ source, entity });
        if (source && el.complete && el.naturalWidth === 0) broken.push(source);
      }
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || bg === 'none') continue;
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) continue;
        // Backgrounds were only filtered on header/nav/footer, so the avatar and
        // control exclusions applied to <img> silently did not apply here — which
        // is how a donor avatar rendered as a background got counted as a duplicate
        // photo. Same rules, both sources.
        const bgCls = el.className?.toString?.() ?? '';
        if (el.closest('header, nav, footer') !== null) continue;
        if (el.closest('button, [role="button"]') !== null) continue;
        if (/logo|avatar|icon/i.test(bgCls)) continue;
        const entity = el.getAttribute('data-image-entity') ?? el.closest('[data-image-entity]')?.getAttribute('data-image-entity') ?? null;
        out.push({ source: m[1], entity });
      }
      return { sources: out, broken };
    });

    const raw = rendered.sources;
    for (const source of rendered.broken) {
      brokenImages.push({ path, source });
      console.log(`BROKEN ${path}: ${source}`);
    }
    for (const { source } of raw.filter(({ source }) => /picsum|loremflickr/i.test(source))) {
      placeholderImages.push({ path, source });
      console.log(`PLACEHOLDER ${path}: ${source}`);
    }

    analyzed++;

    const counts = new Map();
    for (const { source, entity } of raw) {
      const id = imageIdentity(source);
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (!seenAcross.has(id)) seenAcross.set(id, { paths: new Set(), entities: new Set() });
      seenAcross.get(id).paths.add(path);
      seenAcross.get(id).entities.add(entity);
    }

    const dupes = [...counts.entries()].filter(([, n]) => n > 1);
    if (dupes.length) {
      for (const [id, n] of dupes) {
        withinPage.push({ path, id, n });
        console.log(`✗ ${path} — ${id} appears ${n}×`);
      }
    }
  } catch (e) {
    errors.push(path);
    console.log(`! ${path} — ${String(e.message).slice(0, 70)}`);
  }
}

await b.close();

console.log(`\n· analyzed ${analyzed} of ${list.length} routes (${sampled.length} sampled campaigns)`);

// A clean result from a sweep that measured nothing is the failure mode every
// audit in this repo has hit at least once. Refuse to report it.
if (errors.length) {
  console.log(`\n⚠️  ${errors.length} route(s) failed to load — is the server up on ${BASE}?`);
  console.log(`   Only ${analyzed} page(s) were analyzed, so a clean result would be meaningless.`);
  console.log('   If the server IS up, this audit needs a PRODUCTION build:');
  console.log('   `npm run build && npx next start -p 3100`, then re-run against that port.');
  process.exit(1);
}
if (analyzed === 0) {
  console.log('\n⚠️  Nothing was analyzed.');
  process.exit(1);
}

const shared = [...seenAcross.entries()].filter(([, usage]) => usage.paths.size > 1);
const unrelatedShared = shared.filter(([, usage]) => usage.entities.size !== 1 || usage.entities.has(null));
// ⚠️ THIS WAS "0 SHARED IMAGES ACROSS PAGES, OR FAIL", AND IT IS UNSATISFIABLE.
//
// The sweep covers 115 public routes. The photo catalog holds 45 photographs. An
// image that may appear on only one route therefore needs 115+ photographs, and
// no arrangement of 45 can satisfy it.
//
// It passed once, for a bad reason: every uncovered slot rendered GENERATED ART
// (`/media/subject?…`), which carries no `unsplash:` identity and so was never
// counted. The gate was green precisely because the site showed coloured blocks
// with text on them instead of photographs — the defect fixed in #362, and the
// one the product owner explicitly asked to be rid of.
//
// So it becomes a RATCHET. It does not pretend the variety is sufficient; it
// stops it degrading, and the number below is the standing debt.
const MAX_UNRELATED_SHARED = 29;
if (STRICT_GLOBAL && unrelatedShared.length > MAX_UNRELATED_SHARED) {
  for (const [identity, usage] of unrelatedShared) {
    process.stdout.write(`SHARED ${identity}: ${[...usage.paths].join(', ')}\n`);
  }
  process.stdout.write(
    `\nGlobal image uniqueness failures: ${unrelatedShared.length}, up from ${MAX_UNRELATED_SHARED}.\n`
    + 'This ratchet only moves down. Clearing it needs more photographs — curated\n'
    + 'catalog IDs, or UNSPLASH_ACCESS_KEY set so live themed covers resolve per\n'
    + 'campaign — not a wider spread of the ones already here.\n',
  );
  process.exit(1);
}
if (STRICT_GLOBAL) {
  process.stdout.write(
    `· ${unrelatedShared.length} images appear on unrelated pages (ratchet: ≤ ${MAX_UNRELATED_SHARED})\n`,
  );
}
const sameEntityShared = shared.length - unrelatedShared.length;
console.log(`· ${seenAcross.size} distinct images; ${sameEntityShared} repeat only for the same entity across pages (allowed)`);

if (brokenImages.length || placeholderImages.length) {
  console.log(`\nImage integrity failures: ${brokenImages.length} broken; ${placeholderImages.length} generic placeholder.`);
  process.exit(1);
}

if (withinPage.length) {
  console.log(`\n❌ ${withinPage.length} duplicate image(s) within a single page`);
  process.exit(1);
}
console.log(`\n✅ No page shows the same image twice (${analyzed} routes)`);
