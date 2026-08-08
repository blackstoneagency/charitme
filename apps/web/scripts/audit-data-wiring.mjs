#!/usr/bin/env node
/**
 * Is each page ACTUALLY reading the database, or does it just look like it?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM WITH EVERY OTHER SWEEP
 *
 * Six audits render these routes and measure how they LOOK. Not one of them can
 * tell a query from an array literal: a page whose "Featured causes" section is
 * three hardcoded objects renders beautifully, passes axe, passes contrast, and
 * is a lie about the product. Reading the source does not settle it either —
 * `supabaseAdmin.from('campaigns')` appearing in a file proves a query exists,
 * not that its result reaches the screen.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE EXPERIMENT
 *
 * Render every route TWICE against the same build: once with the stub populated,
 * once with `--empty`, which answers every table with zero rows and every RPC
 * with null. Then compare the visible text.
 *
 *   · a page whose content comes from the database MOVES — the list collapses to
 *     its empty state, the counts drop, the cards disappear
 *   · a page whose content is hardcoded is IDENTICAL, byte for byte
 *
 * Identical is not automatically a bug. `/terms` has no database content and
 * should not move. That is why the output separates the two cases and why the
 * exemption list below is explicit: a static page must be NAMED as static, and
 * naming it is a claim someone can check.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES NOT PROVE
 *
 * That the query is CORRECT, that RLS admits the right rows, or that production
 * data looks like the fixtures. It proves the page's content is downstream of a
 * read. Do not write it up as more than that.
 *
 * ⚠️ **ONE app, ONE stub, toggled between passes — and it has to be that way.**
 * The obvious design (two stubs, two `next start` instances) cannot work and
 * fails in the direction that looks like a result: Next inlines every
 * `NEXT_PUBLIC_*` variable into the bundles at BUILD time, so the Supabase URL
 * is a literal inside `.next/server/**` and passing a different one to
 * `next start` changes nothing. Both servers then read the SAME populated stub,
 * every route compares identical, and the honest-looking output is "the entire
 * site is hardcoded". Verify the premise yourself if this is ever rebuilt:
 * `grep -rl '127.0.0.1:<port>' .next/server/` finds the baked literal.
 *
 * So the app stays put and the DATA changes underneath it, via the stub's
 * `/__stub/mode` control route.
 *
 * ⚠️ One residual blind spot, pointing the safe way: a section fetched in the
 * BROWSER goes to the same stub, which is toggled too — so that is covered. What
 * is NOT covered is a page that caches across the toggle. `dynamic`
 * = 'force-dynamic' pages re-read; a statically-rendered page will not, and
 * reports identical. That yields a false "identical", never a false "wired": a
 * route reported as changing definitely reads the database; one reported as
 * identical still has to be opened and read.
 *
 *   node scripts/audit-data-wiring.mjs --base http://127.0.0.1:4141 --stub http://127.0.0.1:54400
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv;
const argOf = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};
const BASE = argOf('--base', 'http://127.0.0.1:4141');
const STUB = argOf('--stub', 'http://127.0.0.1:54400');
const AS_JSON = argv.includes('--json');

/** Flip the stub between populated and empty, and prove the flip took. */
async function setStubEmpty(empty) {
  const res = await fetch(`${STUB}/__stub/mode?empty=${empty ? '1' : '0'}`, { method: 'POST' });
  if (!res.ok) throw new Error(`stub control returned ${res.status} — is --stub correct?`);
  const body = await res.json();
  if (body.empty !== empty) throw new Error('the stub did not change mode');
  // An unasserted toggle is how this audit would silently compare a run against
  // itself and report every route as hardcoded.
  const probe = await fetch(`${STUB}/rest/v1/campaigns?limit=1`).then((r) => r.json());
  const populated = Array.isArray(probe) && probe.length > 0;
  if (populated === empty) throw new Error(`stub mode empty=${empty} but campaigns returned ${probe.length} rows`);
}

const manifest = JSON.parse(readFileSync(join(HERE, '..', 'e2e', 'public-routes.json'), 'utf8'));
const ROUTES = manifest.public;

/**
 * Routes with no database content, and the reason each one has none.
 *
 * ⚠️ An entry here is a CLAIM: "this page is meant to be identical with the
 * database empty". Adding one to silence a finding is how a hardcoded homepage
 * gets blessed as static. Every reason below names what the page contains.
 */
const STATIC_BY_DESIGN = {
  '/terms': 'legal text',
  '/privacy': 'legal text',
  '/cookies': 'legal text',
  '/accessibility': 'a published commitment, not a measurement',
  '/offline': 'the service-worker fallback; it must render with NOTHING available',
  '/security': 'a description of controls',
  '/how-it-works': 'explanatory copy',
  '/pricing': 'the fee model lives in @shared/fees, deliberately not in a table',
  '/create/choose-path': 'a fork in the wizard — two links',
  '/login': 'a form',
  '/signup': 'a form',
  '/forgot-password': 'a form',
  '/contact': 'a form',
  '/thank-you': 'renders from a Stripe session id, not from a listing',
};

function normalise(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function textOf(browser, path) {
  const page = await browser.newPage();
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30_000 });
    const status = response?.status() ?? 0;
    // ⚠️ Always assert the status. A failed navigation renders Chromium's error
    // page, whose text is identical on every route — which would score as
    // "identical in both runs" and be reported as a hardcoded page.
    if (status !== 200) return { status, text: null };
    const text = await page.evaluate(() => document.body.innerText);
    return { status, text: normalise(text) };
  } catch (e) {
    return { status: 0, text: null, error: String(e.message).slice(0, 80) };
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});

const wired = [];
const identical = [];
const skipped = [];

// Both passes run against the same server. Sweep populated first so a crash
// mid-run leaves the stub in its normal state for whatever runs next.
await setStubEmpty(false);
const fullPass = new Map();
for (const path of ROUTES) fullPass.set(path, await textOf(browser, path));

await setStubEmpty(true);
const emptyPass = new Map();
for (const path of ROUTES) emptyPass.set(path, await textOf(browser, path));

await setStubEmpty(false);

for (const path of ROUTES) {
  const full = fullPass.get(path);
  const empty = emptyPass.get(path);

  if (full.text === null || empty.text === null) {
    skipped.push({ path, full: full.status, empty: empty.status, error: full.error ?? empty.error });
    continue;
  }

  if (full.text === empty.text) {
    identical.push({ path, chars: full.text.length });
  } else {
    wired.push({ path, delta: full.text.length - empty.text.length });
  }
}

await browser.close();

const unexplained = identical.filter((r) => !(r.path in STATIC_BY_DESIGN));
const explained = identical.filter((r) => r.path in STATIC_BY_DESIGN);

if (AS_JSON) {
  console.log(JSON.stringify({ wired, identical, unexplained, skipped }, null, 2));
} else {
  console.log(`\n· ${wired.length} routes change when the database empties — their content is downstream of a read`);
  console.log(`· ${explained.length} are identical and declared static by design`);
  if (skipped.length) {
    console.log(`\n⚠ ${skipped.length} could not be compared (non-200 in one or both runs):`);
    for (const s of skipped) console.log(`   ${s.path} — full ${s.full}, empty ${s.empty}${s.error ? ` (${s.error})` : ''}`);
  }
  if (unexplained.length) {
    console.log(`\n❌ ${unexplained.length} render IDENTICALLY with the database empty and are not declared static:`);
    for (const r of unexplained) console.log(`   ${r.path} (${r.chars} chars, unchanged)`);
    console.log('\nEither the page is hardcoded, or it is genuinely static and belongs in');
    console.log('STATIC_BY_DESIGN with a reason naming what it contains.');
  } else {
    console.log('\n✅ Every route either changes with the data or is declared static.');
  }
}

process.exit(unexplained.length > 0 || skipped.length > 0 ? 1 : 0);
