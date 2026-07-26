#!/usr/bin/env node
/**
 * Campaign image audit — CI guard against broken, duplicate, or malformed
 * campaign cover imagery.
 *
 * The single source of truth for campaign imagery is `lib/photo-catalog.ts`
 * (every campaign card / detail / spotlight ultimately resolves its cover from
 * that catalog, either directly or as the fallback when a campaign's stored
 * `cover_image_url` is null). This script audits that catalog.
 *
 * Static checks (always run, no network needed):
 *   - Every category pool has at least MIN_POOL distinct photos.
 *   - Every category's *cover* photo (pool[0]) is distinct across categories
 *     (no two categories share the same hero image).
 *   - Every URL uses an approved host and carries width + quality params.
 *   - No pool contains a duplicate photo ID within itself.
 *
 * Live check (opt-in with `--live`, used in CI where network is allowed):
 *   - Every distinct photo ID returns HTTP 200 — across BOTH the catalog and
 *     the campaign-image URLs written by SQL migrations (the images that
 *     actually land in the database), so a removed upstream photo in either
 *     source is caught.
 *
 * Exits non-zero when any critical check fails so it can gate CI.
 *
 * Usage:
 *   node scripts/audit-campaign-images.mjs          # static only
 *   node scripts/audit-campaign-images.mjs --live   # + HTTP 200 verification
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'lib', 'photo-catalog.ts');
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
const APPROVED_HOSTS = ['images.unsplash.com'];
const MIN_POOL = 4;
const LIVE = process.argv.includes('--live');

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const src = readFileSync(CATALOG, 'utf8');

// ---------------------------------------------------------------------------
// Parse the catalog by evaluating the module's exported structures. We avoid a
// TS toolchain dependency by lightly transpiling the pieces we need: the `C`
// alias map, the `unsplash()` helper, CATEGORY_PHOTOS, and FALLBACK_PHOTOS.
// ---------------------------------------------------------------------------
function evalCatalog(source) {
  const BASE = 'https://images.unsplash.com/photo';
  const Q = 'auto=format&fit=crop&w=800&q=80';
  const QW = 'auto=format&fit=crop&w=1200&q=85';
  const unsplash = (id, wide = false) => `${BASE}-${id}?${wide ? QW : Q}`;

  // Pull the `const C = { ... };` alias map.
  const cMatch = source.match(/const C = \{([\s\S]*?)\};/);
  const C = {};
  if (cMatch) {
    for (const m of cMatch[1].matchAll(/(\w+):\s*'([^']+)'/g)) C[m[1]] = m[2];
  }

  // Extract a Record<...> object literal body by name.
  const grab = (name) => {
    const re = new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\};|\\[[\\s\\S]*?\\n\\];)`);
    const m = source.match(re);
    return m ? m[1] : null;
  };

  // Turn a fragment referencing unsplash()/C into resolved URL strings.
  const resolveList = (fragment) => {
    const urls = [];
    for (const call of fragment.matchAll(/unsplash\(\s*([^)]*?)\s*\)/g)) {
      const args = call[1].split(',').map((s) => s.trim());
      let idExpr = args[0];
      const wide = args[1] === 'true';
      let id;
      if (idExpr.startsWith('C.')) id = C[idExpr.slice(2)];
      else id = idExpr.replace(/^'|'$/g, '');
      if (!id) throw new Error(`Unresolved id expression: ${idExpr}`);
      urls.push(unsplash(id, wide));
    }
    return urls;
  };

  const catBody = grab('CATEGORY_PHOTOS');
  const categories = {};
  if (catBody) {
    // Split into `Name: [ ... ],` blocks.
    for (const block of catBody.matchAll(/(\w+):\s*\[([\s\S]*?)\]/g)) {
      categories[block[1]] = resolveList(block[2]);
    }
  }
  const fbBody = grab('FALLBACK_PHOTOS');
  const fallback = fbBody ? resolveList(fbBody) : [];

  return { categories, fallback };
}

const { categories, fallback } = evalCatalog(src);
const catNames = Object.keys(categories);

if (catNames.length === 0) fail('Parsed zero categories from photo-catalog.ts — parser or catalog broke.');

// ---- Static checks --------------------------------------------------------
const idOf = (url) => (url.match(/photo-([0-9]+-[a-z0-9]+)/) || [])[1] ?? url;
const hostOf = (url) => { try { return new URL(url).host; } catch { return ''; } };

const coverIds = {};
for (const [cat, pool] of Object.entries(categories)) {
  if (pool.length < MIN_POOL) fail(`Category "${cat}" has ${pool.length} photos (min ${MIN_POOL}).`);

  const seen = new Set();
  for (const url of pool) {
    if (!APPROVED_HOSTS.includes(hostOf(url))) fail(`Category "${cat}": non-approved host in ${url}`);
    if (!/[?&]w=\d+/.test(url)) fail(`Category "${cat}": missing width param in ${url}`);
    if (!/[?&]q=\d+/.test(url)) warn(`Category "${cat}": missing quality param in ${url}`);
    const id = idOf(url);
    if (seen.has(id)) warn(`Category "${cat}": repeats photo ${id} within its own pool.`);
    seen.add(id);
  }
  coverIds[cat] = idOf(pool[0]);
}

// Cover uniqueness across categories.
const coverToCats = {};
for (const [cat, id] of Object.entries(coverIds)) (coverToCats[id] ??= []).push(cat);
for (const [id, cats] of Object.entries(coverToCats)) {
  if (cats.length > 1) fail(`Cover photo ${id} is shared by categories: ${cats.join(', ')} (covers must be distinct).`);
}

// ---- Cross-category duplicates ANYWHERE in the pools ----------------------
// The cover check above only inspects pool[0], so a photo reused deeper in two
// different category pools passed silently — yet a visitor browsing both
// categories sees the same image. Measured when this check was added: 6 photos
// are shared, one of them across 15 of the 18 categories. That is a real gap
// against "every image unique", and it is NOT fixable by editing this file —
// it needs 10+ curated replacement photos (live HTTP verification of candidate
// IDs does work from here via `--live`; *finding* good replacements needs the
// Unsplash search API key, i.e. UNSPLASH_ACCESS_KEY).
//
// So: the existing duplicates are a recorded BASELINE that warns, and any NEW
// duplicate fails. That stops the problem growing while leaving it visible
// instead of silently passing.
const DUPLICATE_BASELINE = new Set([
  '1469571486292-0ba58a3f068b', // 15 categories
  '1488521787991-ed7bbaae773c', // 13
  '1593113598332-cd288d649433', // 12
  '1532629345422-7515f3d16bb6', // 10
  '1509099836639-18ba1795216d', // 10
  '1503454537195-1dcabb73ffb9', // 8
  // Competition ↔ Sports share sports imagery (semantically adjacent, but still
  // the same picture on two different category pages).
  '1530549387789-4c1017266635',
  '1571019614242-c5c5dee9f50b',
  '1579952363873-27f3bade9f55',
  '1596462502278-27bfdc403348',
]);

const idToCats = {};
for (const [cat, pool] of Object.entries(categories)) {
  for (const url of pool) {
    (idToCats[idOf(url)] ??= new Set()).add(cat);
  }
}

const foundDupes = [];
for (const [id, catSet] of Object.entries(idToCats)) {
  if (catSet.size < 2) continue;
  foundDupes.push(id);
  const cats = [...catSet].sort().join(', ');
  if (DUPLICATE_BASELINE.has(id)) {
    warn(`Known shared photo ${id} — used by ${catSet.size} categories (${cats}).`);
  } else {
    fail(`NEW cross-category duplicate: photo ${id} in ${cats}. Give each category its own images.`);
  }
}
const fixed = [...DUPLICATE_BASELINE].filter((id) => !foundDupes.includes(id));
if (fixed.length > 0) {
  warn(`${fixed.length} baseline duplicate(s) no longer shared — remove from DUPLICATE_BASELINE: ${fixed.join(', ')}`);
}
console.log(`Shared photos:       ${foundDupes.length} (baseline ${DUPLICATE_BASELINE.size}) — see docs/todo.md`);

// ---- SQL migration images (what actually lands in the DB) -----------------
// The catalog is the app-render source of truth, but campaign covers are also
// written by SQL migrations (campaign_photos*.sql, per-campaign distribution).
// A broken/removed photo there ships to the DB unnoticed unless we check it too.
function collectSqlImageUrls() {
  const urls = new Set();
  let files = [];
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  } catch {
    warn(`Could not read migrations dir at ${MIGRATIONS_DIR}`);
    return [];
  }
  for (const f of files) {
    const text = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    for (const m of text.matchAll(/https?:\/\/[^\s'"]+/g)) {
      const url = m[0].replace(/[)'";,]+$/, '');
      if (/images\.unsplash\.com\/photo-/.test(url)) {
        if (!APPROVED_HOSTS.includes(hostOf(url))) fail(`SQL migration ${f}: non-approved image host in ${url}`);
        urls.add(url);
      }
    }
  }
  return [...urls];
}

const sqlUrls = collectSqlImageUrls();
const sqlDistinctIds = [...new Set(sqlUrls.map(idOf))];

// ---- Collect distinct IDs for live check ----------------------------------
const allUrls = [...Object.values(categories).flat(), ...fallback];
const distinctIds = [...new Set(allUrls.map(idOf))];
// Union of catalog + SQL IDs for the live HTTP verification.
const liveIds = [...new Set([...distinctIds, ...sqlDistinctIds])];

async function httpOk(url) {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch (e) {
    return `ERR ${e.name}`;
  }
}

let liveChecked = 0;
if (LIVE) {
  const sample = liveIds.map((id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&q=60`);
  const results = await Promise.all(sample.map(async (u) => [u, await httpOk(u)]));
  for (const [u, status] of results) {
    liveChecked++;
    if (status !== 200) fail(`Broken image (${status}): ${u}`);
  }
}

// ---- Report ---------------------------------------------------------------
console.log('Campaign image audit');
console.log('────────────────────');
console.log(`Categories:          ${catNames.length}`);
console.log(`Catalog photo IDs:   ${distinctIds.length}`);
console.log(`SQL migration IDs:   ${sqlDistinctIds.length}`);
console.log(`Fallback pool:       ${fallback.length}`);
console.log(`Live HTTP checks:    ${LIVE ? liveChecked : `skipped (pass --live) — would check ${liveIds.length}`}`);
if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  • ${w}`);
}
if (errors.length) {
  console.log(`\nFAILURES (${errors.length}):`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log('\nAudit FAILED.');
  process.exit(1);
}
console.log('\nAudit PASSED.');
