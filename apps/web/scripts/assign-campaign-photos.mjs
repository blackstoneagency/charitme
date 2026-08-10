#!/usr/bin/env node
/**
 * Assign every campaign a REAL, free, on-theme photo — one distinct photo per
 * campaign — and write it to `campaigns.cover_image_url`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SCRIPT AND NOT A RESOLVER
 *
 * `resolveCampaignCover` sees one campaign per call, and uniqueness is a
 * property of the SET. Hashing a seed into a themed pool cannot deliver it: with
 * one 30-photo page it gave 222 of 502 live campaigns (44.2%) a duplicate cover,
 * and even a pool larger than the population collides by the birthday argument
 * (73 draws from 90 slots yields ~55 distinct). The only way to guarantee "every
 * campaign has a different photo" is to assign them together, once, and persist
 * the answer. That is this script.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SOURCE AND LICENCE
 *
 * Unsplash, via the official API. The Unsplash License permits commercial use
 * with no attribution required, which is why `scripts/audit-campaign-images.mjs`
 * approves `images.unsplash.com` and why the site CSP already allows that host
 * and no other photo host. Attribution is still recorded per photo so the
 * product can credit photographers if it chooses.
 *
 * Two credentials are needed and NEITHER is in the repo:
 *   UNSPLASH_ACCESS_KEY        — to search for photos
 *   SUPABASE_SERVICE_ROLE_KEY  — to write cover_image_url (RLS blocks anon)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SAFETY
 *
 *   · DRY RUN BY DEFAULT. Writes only with --commit.
 *   · Never overwrites an organizer's uploaded cover — only generated
 *     first-party art (`/media/subject`) and generic placeholders
 *     (picsum/loremflickr) are replaced.
 *   · Verifies every chosen URL returns HTTP 200 before it is written.
 *   · Refuses to write anything if the assignment is not 100% distinct.
 *   · Idempotent: a campaign that already holds a real photo is left alone, so
 *     re-running costs nothing and cannot churn covers.
 *
 * Usage:
 *   node scripts/assign-campaign-photos.mjs            # dry run, prints a plan
 *   node scripts/assign-campaign-photos.mjs --commit   # writes to Supabase
 *   node scripts/assign-campaign-photos.mjs --limit 20 # sample while testing
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isGeneratedCover, planAssignments, planIsDistinct } from './lib/campaign-photo-plan.mjs';

const argv = process.argv.slice(2);
const COMMIT = argv.includes('--commit');
const LIMIT = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : 0;

/** Read .env.local without a dependency; real values never reach stdout. */
function loadEnv() {
  const merged = { ...process.env };
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#') || !t.includes('=')) continue;
      const k = t.slice(0, t.indexOf('=')).trim();
      const v = t.slice(t.indexOf('=') + 1).trim();
      if (!merged[k]) merged[k] = v;
    }
  } catch { /* no .env.local — rely on the environment */ }
  return merged;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const UNSPLASH = env.UNSPLASH_ACCESS_KEY;

/**
 * Category → search query. Kept in step with `lib/unsplash.ts`'s CATEGORY_QUERY;
 * the script asserts every live category is covered rather than silently
 * falling back, because a category quietly using the generic query is exactly
 * how "on-theme" degrades without anyone noticing.
 */
const CATEGORY_QUERY = {
  Medical: 'hospital healthcare',
  Memorial: 'candle memorial flowers',
  Emergency: 'emergency rescue',
  Nonprofit: 'charity volunteers',
  Education: 'school classroom students',
  Animal: 'animals pets rescue',
  Environment: 'nature landscape conservation',
  Business: 'small business team',
  Community: 'community people together',
  Competition: 'sports competition',
  Creative: 'art creative studio',
  Event: 'celebration event crowd',
  Faith: 'church faith worship',
  Family: 'family together home',
  Sports: 'sports athlete',
  Travel: 'travel adventure',
  Volunteer: 'volunteers helping',
  Wishes: 'hope inspiration sky',
};
const FALLBACK_QUERY = 'charity community help';

async function readAllCampaigns() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/campaigns?select=id,slug,title,category,cover_image_url&order=created_at.asc`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Range: `${from}-${from + 999}` } },
    );
    if (!res.ok) throw new Error(`campaign read failed: HTTP ${res.status}`);
    const batch = await res.json();
    if (!Array.isArray(batch)) throw new Error(`campaign read returned ${JSON.stringify(batch).slice(0, 120)}`);
    out.push(...batch);
    if (batch.length < 1000) break;
  }
  return out;
}

/** Pool enough distinct photos for `need` campaigns; returns [] without a key. */
async function poolFor(category, need) {
  if (!UNSPLASH) return [];
  const query = CATEGORY_QUERY[category] ?? FALLBACK_QUERY;
  const seen = new Set();
  const pool = [];
  // +1 page of headroom: Unsplash occasionally returns near-duplicates that the
  // id de-dupe drops, and a pool that lands one short silently reintroduces a
  // collision the whole script exists to prevent.
  const pages = Math.ceil(need / 30) + 1;
  for (let page = 1; page <= pages; page++) {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}`
      + `&per_page=30&page=${page}&orientation=landscape&content_filter=high`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH}`, 'Accept-Version': 'v1' },
    });
    if (!res.ok) break;
    const body = await res.json();
    for (const p of body.results ?? []) {
      if (!p?.urls?.raw || seen.has(p.id)) continue;
      seen.add(p.id);
      const sep = p.urls.raw.includes('?') ? '&' : '?';
      pool.push({
        id: p.id,
        url: `${p.urls.raw}${sep}auto=format&fit=crop&crop=entropy&w=800&h=600&q=80`,
        author: p.user?.name ?? '',
      });
    }
    if (pool.length >= need) break;
  }
  return pool;
}

async function verify(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (!SUPABASE_URL || !ANON) {
    console.error('✗ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required to read campaigns.');
    process.exit(2);
  }

  const all = await readAllCampaigns();
  const campaigns = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  console.log(`· read ${all.length} campaigns${LIMIT ? ` (sampling ${campaigns.length})` : ''}`);

  const uploaded = campaigns.filter((c) => !isGeneratedCover(c.cover_image_url));
  const needPhoto = campaigns.filter((c) => isGeneratedCover(c.cover_image_url));
  console.log(`· ${uploaded.length} already hold a real cover and are left untouched`);
  console.log(`· ${needPhoto.length} hold generated art and need a real photo`);

  const byCategory = new Map();
  for (const c of needPhoto) {
    const key = c.category || 'Uncategorized';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(c);
  }

  const unknown = [...byCategory.keys()].filter((c) => !CATEGORY_QUERY[c]);
  if (unknown.length) {
    console.log(`⚠ ${unknown.length} categor(ies) have no themed query and would use the generic one: ${unknown.join(', ')}`);
  }

  if (!UNSPLASH) {
    console.log('\n✗ UNSPLASH_ACCESS_KEY is not set, so no photos can be sourced.');
    console.log('  Everything above is measured; the plan below is what a keyed run would do:');
    for (const [cat, list] of [...byCategory].sort((a, b) => b[1].length - a[1].length)) {
      const pages = Math.ceil(list.length / 30) + 1;
      console.log(`    ${cat.padEnd(14)} ${String(list.length).padStart(4)} campaigns → pool ${pages} page(s) = ${pages * 30} photos`);
    }
    process.exit(3);
  }

  const pools = new Map();
  for (const [cat, list] of byCategory) pools.set(cat, await poolFor(cat, list.length));

  const { assignments, shortfall } = planAssignments(needPhoto, pools);

  if (shortfall.length) {
    console.error('\n✗ Not enough distinct photos to give every campaign its own:');
    shortfall.forEach((s) => console.error(`    ${s.category}: ${s.campaigns} campaigns but only ${s.photos} distinct photos`));
    console.error('  Refusing to assign — a partial run would leave duplicates behind.');
    process.exit(1);
  }

  if (!planIsDistinct(assignments)) {
    const urls = new Set(assignments.map((a) => a.photo.url));
    console.error(`\n✗ assignment is not distinct: ${assignments.length} campaigns → ${urls.size} photos. Refusing to write.`);
    process.exit(1);
  }
  console.log(`· assigned ${assignments.length} campaigns ${assignments.length} DISTINCT photos`);

  let bad = 0;
  for (const a of assignments) {
    if (!(await verify(a.photo.url))) {
      console.error(`  ✗ ${a.campaign.slug}: photo did not return 200 — ${a.photo.url.slice(0, 80)}`);
      bad++;
    }
  }
  if (bad) {
    console.error(`\n✗ ${bad} photo(s) failed verification. Refusing to write.`);
    process.exit(1);
  }
  console.log(`· verified all ${assignments.length} photo URLs return HTTP 200`);

  if (!COMMIT) {
    console.log('\n— DRY RUN — pass --commit to write. Sample:');
    assignments.slice(0, 5).forEach((a) =>
      console.log(`    [${a.campaign.category}] ${a.campaign.title.slice(0, 40)}\n        ${a.photo.url.slice(0, 96)}  © ${a.photo.author}`));
    return;
  }

  if (!SERVICE) {
    console.error('\n✗ --commit needs SUPABASE_SERVICE_ROLE_KEY (RLS blocks anon writes to campaigns).');
    process.exit(2);
  }

  let written = 0;
  for (const a of assignments) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?id=eq.${a.campaign.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ cover_image_url: a.photo.url }),
    });
    if (!res.ok) {
      console.error(`  ✗ ${a.campaign.slug}: write failed HTTP ${res.status}`);
      continue;
    }
    written++;
  }
  console.log(`\n✅ wrote ${written}/${assignments.length} covers to Supabase`);
  if (written !== assignments.length) process.exit(1);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });
