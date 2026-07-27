#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Audit: tables that hold data nothing reads.
//
// Two of the goal's criteria meet here — "everything wired to Supabase" and
// "≥100 seed records to fully test every feature". A table with 500 rows and no
// reader satisfies the second while failing the first, and counting rows alone
// cannot tell them apart. This crosses the live row counts against the app's
// actual `.from('<table>')` call sites.
//
//   node scripts/audit-orphan-tables.mjs [--min 100]
//
// Read-only: it issues HEAD count requests and never writes.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = join(WEB_ROOT, '..', '..', 'supabase', 'schema.sql');
const minRows = Number(process.argv[process.argv.indexOf('--min') + 1]) || 100;

function env(key) {
  try {
    const raw = readFileSync(join(WEB_ROOT, '.env.local'), 'utf8');
    return (raw.match(new RegExp(`^${key}=(.*)$`, 'm')) || [])[1] || process.env[key] || '';
  } catch {
    return process.env[key] || '';
  }
}

const URL_ = env('NEXT_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_SERVICE_ROLE_KEY');
if (!URL_ || !KEY) {
  console.error('✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available.');
  process.exit(2);
}

// Declared tables, from the generated schema mirror.
const schema = readFileSync(SCHEMA, 'utf8');
const tables = [...schema.matchAll(/CREATE TABLE public\.(\w+)/g)].map((m) => m[1]).sort();

// Every table the application code actually reads or writes.
const readers = new Map();
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx|mjs)$/.test(entry)) continue;
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\.from\(\s*['"`](\w+)['"`]\s*\)/g)) {
      if (!readers.has(m[1])) readers.set(m[1], new Set());
      readers.get(m[1]).add(p.replace(WEB_ROOT + '/', ''));
    }
  }
}
for (const d of ['app', 'lib', 'components', 'scripts']) {
  try { walk(join(WEB_ROOT, d)); } catch { /* optional dir */ }
}

async function countRows(table) {
  try {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404) return { missing: true, count: null };
    if (!res.ok) return { missing: false, count: null };
    const range = res.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    // null, never 0 — an unparseable range is unknown, not an empty table.
    return { missing: false, count: Number.isFinite(total) ? total : null };
  } catch {
    return { missing: false, count: null };
  }
}

const orphans = [];
const missing = [];
const unknown = [];
let checked = 0;

for (const table of tables) {
  const { missing: gone, count } = await countRows(table);
  checked++;
  if (gone) { missing.push(table); continue; }
  if (count === null) { unknown.push(table); continue; }
  if (count >= minRows && !readers.has(table)) orphans.push({ table, count });
}

console.log(`\nChecked ${checked} declared tables against the live database.`);
console.log(`Tables with an application reader: ${tables.filter((t) => readers.has(t)).length}`);

if (missing.length > 0) {
  console.log(`\n⚠ Declared in schema.sql but NOT in the live database (${missing.length}):`);
  for (const t of missing) console.log(`  ${t}`);
}
if (unknown.length > 0) {
  console.log(`\n? Row count unreadable — unknown, not zero (${unknown.length}): ${unknown.join(', ')}`);
}

if (orphans.length === 0) {
  console.log(`\n✅ No table holds ≥${minRows} rows without an application reader.`);
} else {
  console.log(`\n🔴 Seeded but unread — ≥${minRows} rows and no \`.from()\` call site (${orphans.length}):`);
  for (const o of orphans.sort((a, b) => b.count - a.count)) {
    console.log(`  ${o.table.padEnd(32)} ${String(o.count).padStart(6)} rows`);
  }
  console.log('\nThese satisfy "≥100 seed records" while failing "everything wired to Supabase".');
}
