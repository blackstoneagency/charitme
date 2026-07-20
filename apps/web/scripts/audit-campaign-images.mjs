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
 *   - Every distinct photo ID returns HTTP 200.
 *
 * Exits non-zero when any critical check fails so it can gate CI.
 *
 * Usage:
 *   node scripts/audit-campaign-images.mjs          # static only
 *   node scripts/audit-campaign-images.mjs --live   # + HTTP 200 verification
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'lib', 'photo-catalog.ts');
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

// ---- Collect distinct IDs for live check ----------------------------------
const allUrls = [...Object.values(categories).flat(), ...fallback];
const distinctIds = [...new Set(allUrls.map(idOf))];

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
  const sample = distinctIds.map((id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&q=60`);
  const results = await Promise.all(sample.map(async (u) => [u, await httpOk(u)]));
  for (const [u, status] of results) {
    liveChecked++;
    if (status !== 200) fail(`Broken image (${status}): ${u}`);
  }
}

// ---- Report ---------------------------------------------------------------
console.log('Campaign image audit');
console.log('────────────────────');
console.log(`Categories:        ${catNames.length}`);
console.log(`Distinct photo IDs: ${distinctIds.length}`);
console.log(`Fallback pool:     ${fallback.length}`);
console.log(`Live HTTP checks:  ${LIVE ? liveChecked : 'skipped (pass --live)'}`);
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
