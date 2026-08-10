#!/usr/bin/env node
/**
 * Image-uniqueness audit (goal: "every image on every page is unique, 0 duplicates").
 *
 * Two checks:
 *   1. Static assets under apps/web/public — no two files are byte-identical
 *      (same content, different names), which would render as duplicate images.
 *   2. Live DB image columns — each user-facing image URL column is (near-)unique,
 *      so no two campaigns/media/sponsors show the same picture.
 *
 * Read-only. The DB check needs SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF and
 * is reported as unverified when they are absent. CI must either provide them or
 * explicitly request a static-only run. Reads apps/web/.env.local when vars are
 * not already in the env.
 *
 * Usage:
 *   node scripts/image-uniqueness-audit.mjs           # report
 *   node scripts/image-uniqueness-audit.mjs --ci      # exit 1 on any duplicate
 *   node scripts/image-uniqueness-audit.mjs --ci --static-only
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = resolve(ROOT, 'apps/web/public');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

// DB columns that should hold a distinct image per row. `threshold` is the max
// fraction of non-null values allowed to repeat (0 = must be perfectly unique).
const DB_COLUMNS = [
  { table: 'campaigns', column: 'cover_image_url', where: 'deleted_at is null', threshold: 0 },
  { table: 'campaign_media', column: 'public_url', where: null, threshold: 0 },
  { table: 'sponsors', column: 'logo_url', where: null, threshold: 0 },
  { table: 'profiles', column: 'avatar_url', where: null, threshold: 0 },
];

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync(resolve(ROOT, 'apps/web/.env.local'), 'utf8').split(/\r?\n/)) {
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      if (!env[k]) env[k] = line.slice(i + 1).trim();
    }
  } catch { /* optional */ }
  return env;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (IMAGE_EXT.has(extname(name).toLowerCase())) out.push(p);
  }
  return out;
}

function auditStatic() {
  let files = [];
  try { files = walk(PUBLIC_DIR); } catch { return { count: 0, dupes: [] }; }
  const byHash = new Map();
  for (const f of files) {
    const h = createHash('md5').update(readFileSync(f)).digest('hex');
    (byHash.get(h) ?? byHash.set(h, []).get(h)).push(f.replace(ROOT + '\\', '').replace(ROOT + '/', ''));
  }
  const dupes = [...byHash.values()].filter((g) => g.length > 1);
  return { count: files.length, dupes };
}

async function auditDb(env) {
  const results = [];
  const query = async (sql) => {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    return r.json();
  };
  for (const { table, column, where, threshold } of DB_COLUMNS) {
    const w = where ? ` where ${where}` : '';
    const sql =
      `select count(*) filter (where ${column} is not null and ${column} <> '') as nonnull, ` +
      `count(distinct ${column}) as distinct from ${table}${w}`;
    try {
      const rows = await query(sql);
      if (!Array.isArray(rows) || !rows[0]) { results.push({ table, column, error: true }); continue; }
      const nonnull = Number(rows[0].nonnull);
      const distinct = Number(rows[0].distinct);
      const dupCount = nonnull - distinct;
      const allowed = Math.floor(nonnull * threshold);
      results.push({ table, column, nonnull, distinct, dupCount, ok: dupCount <= allowed });
    } catch {
      results.push({ table, column, error: true });
    }
  }
  return results;
}

async function main() {
  const ci = process.argv.includes('--ci');
  const staticOnly = process.argv.includes('--static-only');
  const env = loadEnv();
  let failed = false;
  let dbVerified = false;

  const stat = auditStatic();
  process.stdout.write(`Static assets under apps/web/public: ${stat.count} images\n`);
  if (stat.dupes.length) {
    failed = true;
    process.stdout.write(`  *** ${stat.dupes.length} byte-identical duplicate group(s):\n`);
    process.stdout.write(`${stat.dupes.map((g) => `    ${g.join('  ==  ')}`).join('\n')}\n`);
  } else {
    process.stdout.write('  no byte-identical duplicates.\n');
  }

  if (env.SUPABASE_ACCESS_TOKEN && env.SUPABASE_PROJECT_REF) {
    process.stdout.write('\nLive DB image columns:\n');
    const results = await auditDb(env);
    dbVerified = results.every((result) => !result.error);
    for (const r of results) {
      if (r.error) {
        process.stdout.write(`  ${r.table}.${r.column}: query failed — NOT VERIFIED\n`);
        failed = true;
        continue;
      }
      const tag = r.ok ? 'OK' : '*** DUPLICATES';
      process.stdout.write(`  ${r.table}.${r.column}: ${r.distinct}/${r.nonnull} unique  ${r.dupCount ? `(${r.dupCount} repeated) ` : ''}${tag}\n`);
      if (!r.ok) failed = true;
    }
  } else {
    process.stdout.write('\nLive DB image check NOT VERIFIED (no SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF).\n');
    if (ci && !staticOnly) failed = true;
  }

  const result = failed
    ? 'FAILED: duplicate images or an unverified required check.'
    : dbVerified
      ? 'PASSED: static assets and live database image columns are unique.'
      : 'PARTIAL: static assets are unique; live database images were not checked.';
  process.stdout.write(`\nRESULT: ${result}\n`);
  if (ci && failed) process.exit(1);
}

main().catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(2); });
