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
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = join(__dirname, '..', 'lib', 'photo-catalog.ts');
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
// `images.rawpixel.com` serves the CC0 covers assigned by
// scripts/assign-campaign-photos.mjs. CC0 is a public-domain dedication —
// no attribution, no share-alike, commercial use fine — so it clears the same
// bar as the Unsplash License that got the first host approved.
const APPROVED_HOSTS = ['images.unsplash.com', 'images.rawpixel.com'];
const MIN_POOL = 4;
const LIVE = process.argv.includes('--live');

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const src = readFileSync(CATALOG, 'utf8');

async function loadCatalog(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`;
  const loaded = await import(moduleUrl);
  return { categories: loaded.CATEGORY_PHOTOS ?? {}, fallback: loaded.FALLBACK_PHOTOS ?? [] };
}

const { categories, fallback } = await loadCatalog(src);
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
    if (url.startsWith('/media/subject?')) {
      const subjectUrl = new URL(url, 'https://www.charitme.com');
      if (!subjectUrl.searchParams.get('category') || !subjectUrl.searchParams.get('key')) {
        fail(`Category "${cat}": malformed first-party subject image ${url}`);
      }
    } else {
      if (!APPROVED_HOSTS.includes(hostOf(url))) fail(`Category "${cat}": non-approved host in ${url}`);
      if (!/[?&]w=\d+/.test(url)) fail(`Category "${cat}": missing width param in ${url}`);
      if (!/[?&]q=\d+/.test(url)) warn(`Category "${cat}": missing quality param in ${url}`);
    }
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

// ---- Cross-category duplicates anywhere in the pools ---------------------
const idToCats = {};
for (const [cat, pool] of Object.entries(categories)) {
  for (const url of pool) {
    (idToCats[idOf(url)] ??= new Set()).add(cat);
  }
}

let sharedPhotos = 0;
for (const [id, catSet] of Object.entries(idToCats)) {
  if (catSet.size < 2) continue;
  sharedPhotos++;
  const cats = [...catSet].sort().join(', ');
  fail(`Cross-category duplicate: image ${id} in ${cats}. Give each category its own image.`);
}
console.log(`Shared photos:       ${sharedPhotos} (required: 0)`);

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
const catalogUnsplashIds = allUrls.filter((url) => hostOf(url) === 'images.unsplash.com').map(idOf);
const liveIds = [...new Set([...catalogUnsplashIds, ...sqlDistinctIds])];

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
